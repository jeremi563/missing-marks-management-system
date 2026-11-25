import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { verifySmtpConnection } from "../../src/shared/services/email.service.js";
import { createEmailDatabase, makeSyntheticUser } from "../helpers/email-database.js";

if (process.env.MAILPIT_INTEGRATION !== "1") {
	test("Mailpit integration tests require the explicit test:email:mailpit command", {
		skip: "Run npm run test:email:mailpit to use the local Mailpit service",
	}, () => {});
} else {
	assert.ok(["127.0.0.1", "::1", "localhost"].includes(env.SMTP_HOST), "Mailpit integration tests require a loopback SMTP host");
	assert.equal(env.SMTP_PORT, 1025);
	assert.equal(env.SMTP_SECURE, false);
	assert.equal(env.SMTP_USER, undefined);
	assert.equal(env.SMTP_PASSWORD, undefined);
	assert.equal(new URL(env.DATABASE_URL).hostname, "127.0.0.1", "Use the dedicated dummy test database URL from the Mailpit test script");

	const mailpitBaseUrl = "http://127.0.0.1:8025";
	const passwordHash = await bcrypt.hash("synthetic-mailpit-password", 4);
	let server;
	let apiBaseUrl;

	before(async () => {
		const ready = await fetch(`${mailpitBaseUrl}/readyz`, { signal: AbortSignal.timeout(1500) });
		assert.equal(ready.status, 200, "Mailpit is unavailable; start it with the email-testing Compose profile");
		assert.equal(await verifySmtpConnection(), true, "Mailpit SMTP is unavailable on 127.0.0.1:1025");
		server = app.listen(0, "127.0.0.1");
		await new Promise((resolve, reject) => {
			server.once("listening", resolve);
			server.once("error", reject);
		});
		apiBaseUrl = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
	});

	after(async () => {
		if (server) await new Promise((resolve) => server.close(resolve));
	});

	function makeUser(overrides = {}) {
		return makeSyntheticUser({ passwordHash, ...overrides });
	}

	function sessionToken(userId) {
		return jwt.sign({ roles: ["student"], sessionVersion: 0 }, env.JWT_SECRET, {
			subject: userId,
			expiresIn: "5m",
		});
	}

	async function post(path, body, bearer) {
		return fetch(`${apiBaseUrl}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
			},
			body: JSON.stringify(body),
		});
	}

	async function capturedMessage(recipient) {
		const response = await fetch(`${mailpitBaseUrl}/api/v1/messages?limit=100`);
		assert.equal(response.status, 200);
		const { messages } = await response.json();
		const summary = messages.find(({ To = [] }) => To.some(({ Address }) => Address === recipient));
		assert.ok(summary, `Mailpit did not capture a message for ${recipient}`);
		const messageResponse = await fetch(`${mailpitBaseUrl}/api/v1/message/${encodeURIComponent(summary.ID)}`);
		assert.equal(messageResponse.status, 200);
		return messageResponse.json();
	}

	function assertActionLink(message, path, expiryText) {
		assert.equal(message.From.Address, "no-reply@missingmarks.local");
		assert.ok(message.To.some(({ Address }) => Address.startsWith("synthetic-") && Address.endsWith("@missingmarks.local")));
		assert.match(message.Text, new RegExp(`http://localhost:5173${path.replace("/", "\\/")}\\?token=[A-Za-z0-9_-]+`));
		assert.match(message.HTML, new RegExp(`http://localhost:5173${path.replace("/", "\\/")}\\?token=[A-Za-z0-9_-]+`));
		assert.match(message.Text, new RegExp(expiryText));
		assert.match(message.HTML, new RegExp(expiryText));
		assert.match(message.Text, /If you did not request this/i);
		assert.match(message.HTML, /If you did not request this/i);
	}

	test("resend-verification sends and captures the actual verification message", async () => {
		const recipient = `synthetic-verify-${randomUUID()}@missingmarks.local`;
		const user = makeUser({ id: randomUUID(), email: recipient, emailVerifiedAt: null });
		const database = createEmailDatabase([user]);
		app.locals.prisma = database;

		const response = await post("/resend-verification", { email: recipient });
		assert.equal(response.status, 202);
		const message = await capturedMessage(recipient);
		assert.equal(message.Subject, "Verify your email address");
		assertActionLink(message, "/verify-email", "24 hours");
		const link = message.Text.match(/https?:\/\/[^\s]+\/verify-email\?token=[A-Za-z0-9_-]+/)[0];
		const token = new URL(link).searchParams.get("token");
		assert.equal(database.tokens[0].tokenHash, createHash("sha256").update(token).digest("hex"));
		assert.notEqual(database.tokens[0].tokenHash, token);
	});

	test("forgot-password sends and captures the actual password-reset message", async () => {
		const recipient = `synthetic-reset-${randomUUID()}@missingmarks.local`;
		const user = makeUser({ id: randomUUID(), email: recipient });
		const database = createEmailDatabase([user]);
		app.locals.prisma = database;

		const response = await post("/forgot-password", { email: recipient });
		assert.equal(response.status, 202);
		const message = await capturedMessage(recipient);
		assert.equal(message.Subject, "Reset your password");
		assertActionLink(message, "/reset-password", "1 hour");
		const link = message.Text.match(/https?:\/\/[^\s]+\/reset-password\?token=[A-Za-z0-9_-]+/)[0];
		const token = new URL(link).searchParams.get("token");
		assert.equal(database.tokens[0].tokenHash, createHash("sha256").update(token).digest("hex"));
	});

	test("change-email sends to the pending address and verification completes the change", async () => {
		const oldEmail = `synthetic-old-${randomUUID()}@missingmarks.local`;
		const recipient = `synthetic-change-${randomUUID()}@missingmarks.local`;
		const user = makeUser({ id: randomUUID(), email: oldEmail });
		const database = createEmailDatabase([user]);
		app.locals.prisma = database;

		const response = await post("/change-email", {
			email: recipient,
			currentPassword: "synthetic-mailpit-password",
		}, sessionToken(user.id));
		assert.equal(response.status, 200);
		assert.deepEqual((await response.json()).data, { pendingEmail: recipient, verificationEmailSent: true });
		assert.equal(user.email, oldEmail);
		assert.equal(user.pendingEmail, recipient);

		const message = await capturedMessage(recipient);
		assert.equal(message.Subject, "Verify your email address");
		assertActionLink(message, "/verify-email", "24 hours");
		const link = message.Text.match(/https?:\/\/[^\s]+\/verify-email\?token=[A-Za-z0-9_-]+/)[0];
		const token = new URL(link).searchParams.get("token");
		const verification = await post("/verify-email", { token });
		assert.equal(verification.status, 200);
		assert.equal(user.email, recipient);
		assert.equal(user.pendingEmail, null);
	});
}
