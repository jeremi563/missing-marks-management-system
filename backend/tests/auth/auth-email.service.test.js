import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test?schema=public";
process.env.JWT_SECRET = "auth-email-test-secret-with-at-least-32-characters";

const {
	requestEmailChange,
	requestEmailVerification,
	requestPasswordReset,
	resetPassword,
	verifyEmailAddress,
} = await import("../../src/modules/auth/auth.service.js");
const { logger } = await import("../../src/shared/utils/logger.js");

const hash = (token) => createHash("sha256").update(token).digest("hex");

async function createUser(overrides = {}) {
	return {
		id: "user-1",
		email: "user@missingmarks.local",
		pendingEmail: null,
		passwordHash: await bcrypt.hash("correct-password", 4),
		isActive: true,
		approvalStatus: "APPROVED",
		emailVerifiedAt: new Date(),
		sessionVersion: 0,
		...overrides,
	};
}

function makeDb(users, initialTokens = []) {
	const tokens = [...initialTokens];
	const accountSecurityToken = {
		findUnique: async ({ where }) => {
			const record = tokens.find((entry) => entry.tokenHash === where.tokenHash);
			if (!record) return null;
			return { ...record, user: users.find((user) => user.id === record.userId) };
		},
		updateMany: async ({ where, data }) => {
			const matches = tokens.filter((token) => {
				if (where.id && token.id !== where.id) return false;
				if (where.userId && token.userId !== where.userId) return false;
				if (where.type && token.type !== where.type) return false;
				if (where.usedAt === null && token.usedAt !== null) return false;
				if (where.expiresAt?.gt && token.expiresAt <= where.expiresAt.gt) return false;
				return true;
			});
			for (const token of matches) Object.assign(token, data);
			return { count: matches.length };
		},
		create: async ({ data }) => {
			const token = { id: `token-${tokens.length + 1}`, usedAt: null, ...data };
			tokens.push(token);
			return { id: token.id };
		},
	};
	const user = {
		findUnique: async ({ where }) => users.find((entry) => (
			(where.id && entry.id === where.id)
			|| (where.email && entry.email === where.email)
			|| (where.pendingEmail && entry.pendingEmail === where.pendingEmail)
		)) ?? null,
		update: async ({ where, data }) => {
			const entry = users.find(({ id }) => id === where.id);
			if (!entry) throw new Error("Missing test user");
			for (const [key, value] of Object.entries(data)) {
				entry[key] = value?.increment ? entry[key] + value.increment : value;
			}
			return { ...entry };
		},
	};
	let securityTokenLock = Promise.resolve();
	const db = {
		user,
		accountSecurityToken,
		$transaction: async (callback) => {
			let release;
			const tx = {
				user,
				accountSecurityToken,
				$queryRaw: async () => {
					const previous = securityTokenLock;
					let unlock;
					securityTokenLock = new Promise((resolve) => { unlock = resolve; });
					await previous;
					release = unlock;
					return [];
				},
			};
			try {
				return await callback(tx);
			} finally {
				release?.();
			}
		},
	};
	return { db, users, tokens };
}

test("verification sends one random token while persisting only its hash and 24-hour expiry", async () => {
	const user = await createUser({ emailVerifiedAt: null });
	const state = makeDb([user]);
	let delivered;
	await requestEmailVerification(user.email, state.db, async (email, token) => { delivered = { email, token }; });

	assert.equal(delivered.email, user.email);
	assert.match(delivered.token, /^[A-Za-z0-9_-]{43}$/);
	assert.equal(state.tokens.length, 1);
	assert.equal(state.tokens[0].tokenHash, hash(delivered.token));
	assert.notEqual(state.tokens[0].tokenHash, delivered.token);
	assert.equal(state.tokens[0].type, "EMAIL_VERIFICATION");
	assert.ok(state.tokens[0].expiresAt.getTime() > Date.now() + 23 * 60 * 60 * 1000);
	assert.ok(state.tokens[0].expiresAt.getTime() < Date.now() + 25 * 60 * 60 * 1000);
});

test("unknown, verified, unverified-reset, and inactive-reset accounts do not send mail", async () => {
	const users = [
		await createUser({ id: "verified", email: "verified@missingmarks.local" }),
		await createUser({ id: "unverified", email: "unverified@missingmarks.local", emailVerifiedAt: null }),
		await createUser({ id: "inactive", email: "inactive@missingmarks.local", isActive: false }),
	];
	const state = makeDb(users);
	let sends = 0;
	const send = async () => { sends += 1; };

	await requestEmailVerification("absent@missingmarks.local", state.db, send);
	await requestEmailVerification("verified@missingmarks.local", state.db, send);
	await requestPasswordReset("absent@missingmarks.local", state.db, send);
	await requestPasswordReset("unverified@missingmarks.local", state.db, send);
	await requestPasswordReset("inactive@missingmarks.local", state.db, send);
	assert.equal(sends, 0);
	assert.equal(state.tokens.length, 0);
});

test("password reset sends to verified active accounts with a one-hour hashed token", async () => {
	const user = await createUser();
	const state = makeDb([user]);
	let delivered;
	await requestPasswordReset(user.email, state.db, async (email, token) => { delivered = { email, token }; });

	assert.equal(delivered.email, user.email);
	assert.equal(state.tokens[0].type, "PASSWORD_RESET");
	assert.equal(state.tokens[0].tokenHash, hash(delivered.token));
	assert.ok(state.tokens[0].expiresAt.getTime() > Date.now() + 59 * 60 * 1000);
	assert.ok(state.tokens[0].expiresAt.getTime() < Date.now() + 61 * 60 * 1000);
});

test("failed verification delivery revokes only the undelivered token", async () => {
	const user = await createUser({ emailVerifiedAt: null });
	const prior = {
		id: "prior",
		userId: user.id,
		type: "EMAIL_VERIFICATION",
		tokenHash: hash("old-token"),
		expiresAt: new Date(Date.now() + 60_000),
		usedAt: null,
	};
	const state = makeDb([user], [prior]);
	const failure = Object.assign(new Error("SMTP password and private token must not be logged"), { name: "EmailDeliveryError", category: "connection" });
	const originalWarn = logger.warn;
	let loggedFields;
	logger.warn = (_message, fields) => { loggedFields = fields; };
	try {
		await requestEmailVerification(user.email, state.db, async () => { throw failure; });
	} finally {
		logger.warn = originalWarn;
	}

	assert.equal(state.tokens.length, 2);
	assert.ok(state.tokens.every(({ usedAt }) => usedAt instanceof Date));
	assert.equal(state.tokens[1].tokenHash.length, 64);
	assert.notEqual(state.tokens[1].tokenHash, failure.message);
	assert.deepEqual(loggedFields, { purpose: "verification", errorCategory: "unexpected" });
	assert.doesNotMatch(JSON.stringify(loggedFields), /SMTP password|private token/);
});

test("failed password-reset delivery revokes its token and keeps the response non-enumerating", async () => {
	const user = await createUser();
	const state = makeDb([user]);
	await assert.doesNotReject(requestPasswordReset(user.email, state.db, async () => {
		throw Object.assign(new Error("private smtp failure"), { category: "timeout" });
	}));
	assert.equal(state.tokens.length, 1);
	assert.ok(state.tokens[0].usedAt instanceof Date);
});

test("failed email-change delivery invalidates the token and leaves the old address authoritative", async () => {
	const user = await createUser();
	const state = makeDb([user]);
	const result = await requestEmailChange(user.id, "new@missingmarks.local", "correct-password", state.db, async () => {
		throw Object.assign(new Error("private smtp failure"), { category: "connection" });
	});

	assert.deepEqual(result, { pendingEmail: "new@missingmarks.local", verificationEmailSent: false });
	assert.equal(user.email, "user@missingmarks.local");
	assert.equal(user.pendingEmail, "new@missingmarks.local");
	assert.ok(state.tokens[0].usedAt instanceof Date);
});

test("verification tokens are single-use and expired tokens cannot verify accounts", async () => {
	const user = await createUser({ emailVerifiedAt: null });
	const token = "synthetic-verification-token";
	const valid = {
		id: "valid-token",
		userId: user.id,
		type: "EMAIL_VERIFICATION",
		tokenHash: hash(token),
		expiresAt: new Date(Date.now() + 60_000),
		usedAt: null,
	};
	const state = makeDb([user], [valid]);

	await verifyEmailAddress(token, state.db);
	assert.ok(user.emailVerifiedAt instanceof Date);
	assert.equal(valid.usedAt instanceof Date, true);
	await assert.rejects(verifyEmailAddress(token, state.db), { statusCode: 400 });

	const expiredUser = await createUser({ id: "expired", emailVerifiedAt: null });
	const expiredState = makeDb([expiredUser], [{
		...valid,
		id: "expired-token",
		userId: expiredUser.id,
		tokenHash: hash("expired-token"),
		expiresAt: new Date(Date.now() - 1),
		usedAt: null,
	}]);
	await assert.rejects(verifyEmailAddress("expired-token", expiredState.db), { statusCode: 400 });
	assert.equal(expiredUser.emailVerifiedAt, null);
});

test("concurrent verification attempts consume a token only once", async () => {
	const user = await createUser({ emailVerifiedAt: null });
	const token = "concurrent-verification-token";
	const record = {
		id: "single-use",
		userId: user.id,
		type: "EMAIL_VERIFICATION",
		tokenHash: hash(token),
		expiresAt: new Date(Date.now() + 60_000),
		usedAt: null,
	};
	const state = makeDb([user], [record]);
	const results = await Promise.allSettled([
		verifyEmailAddress(token, state.db),
		verifyEmailAddress(token, state.db),
	]);

	assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
	assert.equal(results.filter(({ status, reason }) => status === "rejected" && reason.statusCode === 400).length, 1);
	assert.ok(record.usedAt instanceof Date);
});

test("issuing a replacement verification token invalidates the previous token", async () => {
	const user = await createUser({ emailVerifiedAt: null });
	const state = makeDb([user]);
	const deliveredTokens = [];
	const send = async (_email, token) => deliveredTokens.push(token);
	await requestEmailVerification(user.email, state.db, send);
	await requestEmailVerification(user.email, state.db, send);

	assert.equal(deliveredTokens.length, 2);
	assert.notEqual(deliveredTokens[0], deliveredTokens[1]);
	assert.ok(state.tokens[0].usedAt instanceof Date);
	assert.equal(state.tokens[1].usedAt, null);
	await assert.rejects(verifyEmailAddress(deliveredTokens[0], state.db), { statusCode: 400 });
	await verifyEmailAddress(deliveredTokens[1], state.db);
	assert.ok(user.emailVerifiedAt instanceof Date);
});

test("concurrent password-reset requests leave only the newest token usable", async () => {
	const user = await createUser();
	const state = makeDb([user]);
	const deliveredTokens = [];
	const send = async (_email, token) => deliveredTokens.push(token);
	await Promise.all([
		requestPasswordReset(user.email, state.db, send),
		requestPasswordReset(user.email, state.db, send),
	]);

	assert.equal(deliveredTokens.length, 2);
	assert.notEqual(deliveredTokens[0], deliveredTokens[1]);
	assert.equal(state.tokens.filter(({ usedAt }) => usedAt === null).length, 1);
	assert.ok(state.tokens.find(({ tokenHash }) => tokenHash === hash(deliveredTokens[0])).usedAt instanceof Date);
	assert.equal(state.tokens.find(({ tokenHash }) => tokenHash === hash(deliveredTokens[1])).usedAt, null);
});

test("email-change requests require the current password and reject address conflicts", async () => {
	const user = await createUser();
	const anotherUser = await createUser({ id: "another-user", email: "taken@missingmarks.local" });
	const state = makeDb([user, anotherUser]);
	let sendCount = 0;
	const send = async () => { sendCount += 1; };

	await assert.rejects(
		requestEmailChange(user.id, "new@missingmarks.local", "incorrect-password", state.db, send),
		{ statusCode: 401 },
	);
	await assert.rejects(
		requestEmailChange(user.id, anotherUser.email, "correct-password", state.db, send),
		{ statusCode: 409 },
	);
	assert.equal(sendCount, 0);
	assert.equal(state.tokens.length, 0);
	assert.equal(user.pendingEmail, null);
});

test("expired email-change links cannot change the authoritative address", async () => {
	const user = await createUser({ pendingEmail: "new@missingmarks.local" });
	const token = "expired-email-change-token";
	const state = makeDb([user], [{
		id: "expired-email-change",
		userId: user.id,
		type: "EMAIL_CHANGE",
		tokenHash: hash(token),
		expiresAt: new Date(Date.now() - 1),
		usedAt: null,
	}]);
	await assert.rejects(verifyEmailAddress(token, state.db), { statusCode: 400 });
	assert.equal(user.email, "user@missingmarks.local");
	assert.equal(user.pendingEmail, "new@missingmarks.local");
});

test("password reset rejects expired and unknown tokens and consumes a valid token once", async () => {
	const user = await createUser();
	const token = "synthetic-password-reset-token";
	const valid = {
		id: "reset-token",
		userId: user.id,
		type: "PASSWORD_RESET",
		tokenHash: hash(token),
		expiresAt: new Date(Date.now() + 60_000),
		usedAt: null,
	};
	const expired = {
		...valid,
		id: "expired-reset",
		tokenHash: hash("expired-reset-token"),
		expiresAt: new Date(Date.now() - 1),
	};
	const state = makeDb([user], [valid, expired]);

	await assert.rejects(resetPassword("unknown-token", "New-Password-12!", state.db), { statusCode: 400 });
	await assert.rejects(resetPassword("expired-reset-token", "New-Password-12!", state.db), { statusCode: 400 });
	await resetPassword(token, "New-Password-12!", state.db);
	assert.equal(user.sessionVersion, 1);
	assert.ok(valid.usedAt instanceof Date);
	await assert.rejects(resetPassword(token, "Another-Password-12!", state.db), { statusCode: 400 });
});
