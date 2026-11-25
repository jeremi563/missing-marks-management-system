import test, { mock } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { createSmtpServer } from "../helpers/smtp-server.js";

process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test?schema=public";
process.env.JWT_SECRET = "email-service-test-secret-with-at-least-32-characters";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1025";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "";
process.env.SMTP_PASSWORD = "";
process.env.SMTP_FROM = "Missing Marks System <no-reply@missingmarks.local>";
process.env.APP_BASE_URL = "http://localhost:5173";

const { EmailDeliveryError, sendPasswordResetEmail, sendVerificationEmail, verifySmtpConnection } = await import("../../src/shared/services/email.service.js");
const { env } = await import("../../src/config/env.js");

function useSmtp(smtp) {
	env.SMTP_HOST = smtp.host;
	env.SMTP_PORT = smtp.port;
}

test("sends a verification message to the requested recipient with its action URL", async () => {
	const smtp = await createSmtpServer();
	useSmtp(smtp);
	try {
		await sendVerificationEmail("student@missingmarks.local", "synthetic-token");
		assert.equal(smtp.messages.length, 1);
		assert.match(smtp.messages[0], /From: Missing Marks System <no-reply@missingmarks\.local>/i);
		assert.match(smtp.messages[0], /To: student@missingmarks\.local/i);
		assert.match(smtp.messages[0], /Subject: Verify your email address/i);
		assert.match(smtp.messages[0], /http:\/\/localhost:5173\/verify-email\?=\r?\ntoken=3Dsynthetic-token/);
		assert.match(smtp.messages[0], /24 hours/);
		assert.match(smtp.messages[0], /Content-Type: text\/html/i);
		assert.match(smtp.messages[0], /If you did not request/i);
	} finally {
		await smtp.close();
		env.SMTP_PORT = 1025;
	}
});

test("sends a password-reset message with a one-hour link and escaped HTML", async () => {
	const smtp = await createSmtpServer();
	useSmtp(smtp);
	try {
		await sendPasswordResetEmail("student@missingmarks.local", "<synthetic&token>");
		assert.equal(smtp.messages.length, 1);
		assert.match(smtp.messages[0], /Subject: Reset your password/i);
		assert.match(smtp.messages[0], /1 hour/);
		assert.match(smtp.messages[0], /token=3D%3Csynthetic%26token%3E/);
		assert.doesNotMatch(smtp.messages[0], /<synthetic&token>/);
		assert.match(smtp.messages[0], /Content-Type: text\/html/i);
		assert.match(smtp.messages[0], /If you did not request/i);
	} finally {
		await smtp.close();
		env.SMTP_PORT = 1025;
	}
});

test("provides an explicit SMTP connectivity diagnostic", async () => {
	const smtp = await createSmtpServer();
	useSmtp(smtp);
	try {
		assert.equal(await verifySmtpConnection(), true);
	} finally {
		await smtp.close();
	}
});

test("reports missing and invalid SMTP configuration with safe structured errors", async () => {
	const oldHost = env.SMTP_HOST;
	const oldUser = env.SMTP_USER;
	const oldPassword = env.SMTP_PASSWORD;
	try {
		env.SMTP_HOST = undefined;
		await assert.rejects(sendVerificationEmail("student@missingmarks.local", "token"), {
			name: "EmailDeliveryError",
			category: "not_configured",
		});
		env.SMTP_HOST = "127.0.0.1";
		env.SMTP_USER = "local-user";
		env.SMTP_PASSWORD = undefined;
		await assert.rejects(sendVerificationEmail("student@missingmarks.local", "token"), {
			name: "EmailDeliveryError",
			category: "invalid_configuration",
		});
	} finally {
		env.SMTP_HOST = oldHost;
		env.SMTP_USER = oldUser;
		env.SMTP_PASSWORD = oldPassword;
	}
});

test("rejects recipient header injection before contacting SMTP", async () => {
	await assert.rejects(sendVerificationEmail("student@missingmarks.local\r\nBcc: other@example.test", "token"), {
		name: "EmailDeliveryError",
		category: "invalid_recipient",
	});
});

test("classifies an unavailable SMTP server without exposing transport details", async () => {
	const smtp = await createSmtpServer();
	const { port } = smtp;
	await smtp.close();
	env.SMTP_HOST = "127.0.0.1";
	env.SMTP_PORT = port;
	await assert.rejects(sendVerificationEmail("student@missingmarks.local", "private-token"), (error) => {
		assert.ok(error instanceof EmailDeliveryError);
		assert.equal(error.category, "connection");
		assert.doesNotMatch(error.message, /private-token|127\.0\.0\.1|password/i);
		return true;
	});
});

test("classifies unexpected Nodemailer exceptions without exposing their details", async () => {
	const originalHost = env.SMTP_HOST;
	const originalPort = env.SMTP_PORT;
	env.SMTP_HOST = "mock-smtp.invalid";
	env.SMTP_PORT = 2526;
	const mockedTransport = {
		sendMail: async () => { throw new Error("private smtp credential and token"); },
		verify: async () => true,
		close() {},
	};
	const mockedFactory = mock.method(nodemailer, "createTransport", () => mockedTransport);
	try {
		await assert.rejects(sendVerificationEmail("student@missingmarks.local", "private-token"), (error) => {
			assert.ok(error instanceof EmailDeliveryError);
			assert.equal(error.category, "unexpected");
			assert.doesNotMatch(error.message, /private smtp credential|private-token|mock-smtp/i);
			return true;
		});
		assert.equal(mockedFactory.mock.callCount(), 1);
	} finally {
		mock.restoreAll();
		env.SMTP_HOST = originalHost;
		env.SMTP_PORT = originalPort;
	}
});

test("classifies SMTP authentication, recipient, and message rejections", async () => {
	const oldUser = env.SMTP_USER;
	const oldPassword = env.SMTP_PASSWORD;
	const authServer = await createSmtpServer({ responses: { auth: "535 5.7.8 Authentication rejected\r\n" } });
	useSmtp(authServer);
	env.SMTP_USER = "synthetic-user";
	env.SMTP_PASSWORD = "synthetic-password";
	try {
		await assert.rejects(sendVerificationEmail("student@missingmarks.local", "token"), {
			name: "EmailDeliveryError",
			category: "authentication",
		});
	} finally {
		await authServer.close();
		env.SMTP_USER = oldUser;
		env.SMTP_PASSWORD = oldPassword;
	}

	const recipientServer = await createSmtpServer({ responses: { recipient: "550 5.1.1 Invalid recipient\r\n" } });
	useSmtp(recipientServer);
	try {
		await assert.rejects(sendVerificationEmail("student@missingmarks.local", "token"), {
			name: "EmailDeliveryError",
			category: "invalid_recipient",
		});
	} finally {
		await recipientServer.close();
	}

	const rejectedServer = await createSmtpServer({ responses: { data: "554 5.7.1 Message rejected\r\n" } });
	useSmtp(rejectedServer);
	try {
		await assert.rejects(sendPasswordResetEmail("student@missingmarks.local", "token"), {
			name: "EmailDeliveryError",
			category: "rejected",
		});
	} finally {
		await rejectedServer.close();
		env.SMTP_PORT = 1025;
	}
});

test("classifies a stalled SMTP greeting as a timeout", async () => {
	const smtp = await createSmtpServer({ greetingDelayMs: -1 });
	useSmtp(smtp);
	try {
		await assert.rejects(sendVerificationEmail("student@missingmarks.local", "token"), {
			name: "EmailDeliveryError",
			category: "timeout",
		});
	} finally {
		await smtp.close();
		env.SMTP_PORT = 1025;
	}
});
