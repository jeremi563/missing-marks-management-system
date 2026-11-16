import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../utils/app-error.js";

function getTransport() {
	if (!env.SMTP_HOST || !env.SMTP_FROM || !env.APP_BASE_URL || (env.SMTP_USER && !env.SMTP_PASSWORD)) {
		throw new AppError(503, "Email delivery is not configured");
	}
	return nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } } : {}),
	});
}

async function sendAccountLink({ to, subject, path, token, action }) {
	const url = new URL(path, env.APP_BASE_URL);
	url.searchParams.set("token", token);
	await getTransport().sendMail({
		from: env.SMTP_FROM,
		to,
		subject,
		text: `${action}: ${url.toString()}\n\nIf you did not request this, you can ignore this message.`,
	});
}

export function sendVerificationEmail(to, token) {
	return sendAccountLink({ to, token, path: "/verify-email", subject: "Verify your email address", action: "Verify your email" });
}

export function sendPasswordResetEmail(to, token) {
	return sendAccountLink({ to, token, path: "/reset-password", subject: "Reset your password", action: "Reset your password" });
}