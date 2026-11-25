import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createSmtpServer } from "../helpers/smtp-server.js";
import { createEmailDatabase, makeSyntheticUser } from "../helpers/email-database.js";

process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test?schema=public";
process.env.JWT_SECRET = "auth-email-routes-test-secret-32-characters";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1025";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "";
process.env.SMTP_PASSWORD = "";
process.env.SMTP_FROM = "Missing Marks System <no-reply@missingmarks.local>";
process.env.APP_BASE_URL = "http://localhost:5173";

const [{ app }, { env }] = await Promise.all([
	import("../../src/app.js"),
	import("../../src/config/env.js"),
]);
const syntheticPasswordHash = await bcrypt.hash("synthetic-password", 4);

function makeUser(overrides = {}) {
	return makeSyntheticUser({ passwordHash: syntheticPasswordHash, ...overrides });
}

let server;
let smtp;
let baseUrl;

before(async () => {
	smtp = await createSmtpServer();
	env.SMTP_PORT = smtp.port;
	server = app.listen(0, "127.0.0.1");
	await new Promise((resolve, reject) => {
		server.once("listening", resolve);
		server.once("error", reject);
	});
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
});

after(async () => {
	if (server) await new Promise((resolve) => server.close(resolve));
	if (smtp) await smtp.close();
});

function decodeQuotedPrintable(value) {
	return value
		.replace(/=\r?\n/g, "")
		.replace(/=([a-f\d]{2})/gi, (_match, byte) => String.fromCharCode(Number.parseInt(byte, 16)));
}

function extractToken(message, expectedPath) {
	const decoded = decodeQuotedPrintable(message);
	const match = new RegExp(`${expectedPath.replace("/", "\\/")}\\?token=([A-Za-z0-9_-]+)`).exec(decoded);
	assert.ok(match, `Expected a tokenized ${expectedPath} link in the captured message`);
	return match[1];
}

async function post(path, body, { token } = {}) {
	return fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	});
}

function sessionToken(userId) {
	return jwt.sign({ roles: ["student"], sessionVersion: 0 }, process.env.JWT_SECRET, {
		subject: userId,
		expiresIn: "5m",
	});
}

test("verification endpoint sends a message and confirms its single-use token", async () => {
	const user = makeUser({ id: randomUUID(), email: `verify-${randomUUID()}@missingmarks.local`, emailVerifiedAt: null });
	const database = createEmailDatabase([user]);
	app.locals.prisma = database;
	const response = await post("/resend-verification", { email: user.email });
	const body = await response.json();

	assert.equal(response.status, 202);
	assert.equal(body.message, "If the account can be verified, an email will be sent shortly");
	assert.doesNotMatch(JSON.stringify(body), /token/i);
	const message = smtp.messages.at(-1);
	assert.match(message, new RegExp(`To: ${user.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
	assert.match(message, /Subject: Verify your email address/i);
	const token = extractToken(message, "/verify-email");
	assert.equal(database.tokens[0].tokenHash, createHash("sha256").update(token).digest("hex"));
	assert.notEqual(database.tokens[0].tokenHash, token);

	const verifyResponse = await post("/verify-email", { token });
	assert.equal(verifyResponse.status, 200);
	assert.ok(user.emailVerifiedAt instanceof Date);
	assert.ok(database.tokens[0].usedAt instanceof Date);
	assert.equal((await post("/verify-email", { token })).status, 400);
});

test("password-reset endpoint returns an enumeration-safe response and sends only eligible accounts", async () => {
	const user = makeUser({ id: randomUUID(), email: `reset-${randomUUID()}@missingmarks.local` });
	const database = createEmailDatabase([user]);
	app.locals.prisma = database;

	const knownResponse = await post("/forgot-password", { email: user.email });
	const knownBody = await knownResponse.json();
	assert.equal(knownResponse.status, 202);
	assert.equal(knownBody.message, "If the account exists, password reset instructions will be sent shortly");
	const message = smtp.messages.at(-1);
	assert.match(message, new RegExp(`To: ${user.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
	assert.match(message, /Subject: Reset your password/i);
	const token = extractToken(message, "/reset-password");
	assert.equal(database.tokens[0].tokenHash, createHash("sha256").update(token).digest("hex"));

	const unknownResponse = await post("/forgot-password", { email: `unknown-${randomUUID()}@missingmarks.local` });
	assert.deepEqual(await unknownResponse.json(), knownBody);
	assert.equal(smtp.messages.length, 2);

	const resetResponse = await post("/reset-password", { token, password: "Replacement-Password-123!" });
	assert.equal(resetResponse.status, 200);
	assert.ok(database.tokens[0].usedAt instanceof Date);
	assert.equal(user.sessionVersion, 1);
	assert.equal((await post("/reset-password", { token, password: "Other-Password-123!" })).status, 400);
});

test("email change requires authentication and changes the authoritative address only after verification", async () => {
	const oldEmail = `old-${randomUUID()}@missingmarks.local`;
	const user = makeUser({ id: randomUUID(), email: oldEmail });
	const database = createEmailDatabase([user]);
	app.locals.prisma = database;
	const newEmail = `new-${randomUUID()}@missingmarks.local`;

	const messageCount = smtp.messages.length;
	const unauthenticated = await post("/change-email", { email: newEmail, currentPassword: "synthetic-password" });
	assert.equal(unauthenticated.status, 401);
	assert.equal(smtp.messages.length, messageCount);

	const response = await post("/change-email", { email: newEmail, currentPassword: "synthetic-password" }, {
		token: sessionToken(user.id),
	});
	assert.equal(response.status, 200);
	assert.deepEqual((await response.json()).data, {
		pendingEmail: newEmail,
		verificationEmailSent: true,
	});
	assert.equal(user.email, oldEmail);
	assert.equal(user.pendingEmail, newEmail);
	const message = smtp.messages.at(-1);
	assert.match(message, new RegExp(`To: ${newEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
	assert.match(message, /Subject: Verify your email address/i);
	const token = extractToken(message, "/verify-email");

	const verifyResponse = await post("/verify-email", { token });
	assert.equal(verifyResponse.status, 200);
	assert.equal(user.email, newEmail);
	assert.equal(user.pendingEmail, null);
});

test("invalid recovery request input is rejected before email or token side effects", async () => {
	const user = makeUser({ id: randomUUID(), email: "validation@missingmarks.local", emailVerifiedAt: null });
	const database = createEmailDatabase([user]);
	app.locals.prisma = database;
	const countBefore = smtp.messages.length;

	assert.equal((await post("/resend-verification", { email: "invalid" })).status, 400);
	assert.equal((await post("/forgot-password", { email: "invalid" })).status, 400);
	assert.equal((await post("/change-email", { email: "invalid", currentPassword: "synthetic-password" }, {
		token: sessionToken(user.id),
	})).status, 400);
	assert.equal(smtp.messages.length, countBefore);
	assert.equal(database.tokens.length, 0);
});

test("recovery email requests are rate limited before another token or email is created", async () => {
	const user = makeUser({ id: randomUUID(), email: `limited-${randomUUID()}@missingmarks.local`, emailVerifiedAt: null });
	const database = createEmailDatabase([user]);
	app.locals.prisma = database;
	const sentBefore = smtp.messages.length;
	const responses = [];
	for (let attempt = 0; attempt < 6; attempt += 1) {
		responses.push(await post("/resend-verification", { email: user.email }));
	}

	assert.deepEqual(responses.map(({ status }) => status), [202, 202, 202, 202, 202, 429]);
	assert.equal(smtp.messages.length - sentBefore, 5);
	assert.equal(database.tokens.length, 5);
	assert.equal(database.tokens.filter(({ usedAt }) => usedAt === null).length, 1);
});
