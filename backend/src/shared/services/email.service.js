import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

const SMTP_TIMEOUTS = {
	connectionTimeout: 10_000,
	greetingTimeout: 5_000,
	socketTimeout: 30_000,
};

const emailAddressPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
let cachedTransport;
let cachedTransportKey;

export class EmailDeliveryError extends Error {
	constructor(category, message) {
		super(message);
		this.name = "EmailDeliveryError";
		this.category = category;
	}
}

function getEmailConfiguration() {
	if (!env.SMTP_HOST || !env.SMTP_FROM || !env.APP_BASE_URL) {
		throw new EmailDeliveryError("not_configured", "Email delivery is not configured");
	}
	if (!Number.isInteger(env.SMTP_PORT) || env.SMTP_PORT < 1 || env.SMTP_PORT > 65535
		|| Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)
		|| !emailAddressPattern.test(env.SMTP_FROM.match(/<([^<>]+)>$/)?.[1] ?? env.SMTP_FROM)) {
		throw new EmailDeliveryError("invalid_configuration", "Email delivery configuration is invalid");
	}
	return {
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		user: env.SMTP_USER,
		password: env.SMTP_PASSWORD,
		from: env.SMTP_FROM,
		appBaseUrl: env.APP_BASE_URL,
	};
}

function getTransport() {
	const config = getEmailConfiguration();
	const transportKey = JSON.stringify([config.host, config.port, config.secure, config.user, config.password]);
	if (cachedTransport && cachedTransportKey === transportKey) return cachedTransport;

	cachedTransport?.close();
	cachedTransport = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure,
		...SMTP_TIMEOUTS,
		...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
	});
	cachedTransportKey = transportKey;
	return cachedTransport;
}

function classifySmtpError(error) {
	const code = typeof error?.code === "string" ? error.code.toUpperCase() : "";
	const command = typeof error?.command === "string" ? error.command.toUpperCase() : "";
	const responseCode = Number(error?.responseCode);
	if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT"
		|| (code === "ESOCKET" && /timed?\s*out|timeout/i.test(error?.message ?? ""))) {
		return "timeout";
	}
	if (code === "EAUTH" || responseCode === 535 || responseCode === 534) return "authentication";
	if (command.startsWith("RCPT")) return "invalid_recipient";
	if (code === "EENVELOPE" && !command.startsWith("DATA")) return "invalid_recipient";
	if (["ECONNECTION", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "EDNS"].includes(code)) {
		return "connection";
	}
	if (code === "ESOCKET" && /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENOTFOUND/i.test(error?.message ?? "")) {
		return "connection";
	}
	if (responseCode >= 400) return "rejected";
	return "unexpected";
}

function toEmailDeliveryError(error) {
	if (error instanceof EmailDeliveryError) return error;
	const category = classifySmtpError(error);
	const messages = {
		timeout: "SMTP operation timed out",
		authentication: "SMTP authentication failed",
		invalid_recipient: "SMTP server rejected the recipient",
		connection: "Could not connect to the SMTP server",
		rejected: "SMTP server rejected the message",
		unexpected: "Unexpected email delivery failure",
	};
	return new EmailDeliveryError(category, messages[category]);
}

function escapeHtml(value) {
	return value.replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;",
	})[character]);
}

async function sendAccountLink({ to, subject, path, token, action, expiry }) {
	const config = getEmailConfiguration();
	if (typeof to !== "string" || !emailAddressPattern.test(to)) {
		throw new EmailDeliveryError("invalid_recipient", "Email recipient is invalid");
	}
	const url = new URL(path, config.appBaseUrl);
	url.searchParams.set("token", token);
	const actionUrl = url.toString();
	const text = `${action}\n\n${actionUrl}\n\nThis link expires in ${expiry}. If you did not request this, you can ignore this message.`;
	const html = [
		`<p>${escapeHtml(action)} using the secure link below.</p>`,
		`<p><a href="${escapeHtml(actionUrl)}">${escapeHtml(action)}</a></p>`,
		`<p>This link expires in ${escapeHtml(expiry)}.</p>`,
		"<p>If you did not request this, you can ignore this message.</p>",
	].join("\n");

	try {
		const result = await getTransport().sendMail({
			from: config.from,
			to,
			subject,
			text,
			html,
		});
		if (result.rejected?.length) throw Object.assign(new Error(), { command: "RCPT TO" });
	} catch (error) {
		throw toEmailDeliveryError(error);
	}
}

export async function verifySmtpConnection() {
	try {
		await getTransport().verify();
		return true;
	} catch (error) {
		throw toEmailDeliveryError(error);
	}
}

export function sendVerificationEmail(to, token) {
	return sendAccountLink({
		to,
		token,
		path: "/verify-email",
		subject: "Verify your email address",
		action: "Verify your email address",
		expiry: "24 hours",
	});
}

export function sendPasswordResetEmail(to, token) {
	return sendAccountLink({
		to,
		token,
		path: "/reset-password",
		subject: "Reset your password",
		action: "Reset your password",
		expiry: "1 hour",
	});
}
