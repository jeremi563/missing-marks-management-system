import { env } from "../../config/env.js";
import { sendSuccess } from "../../shared/utils/api-response.js";
import { AppError } from "../../shared/utils/app-error.js";
import {
	loginWithCredentials,
	registerAccount,
	requestEmailVerification,
	verifyEmailAddress,
	requestPasswordReset,
	resetPassword,
} from "./auth.service.js";

const cookieOptions = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: "strict",
	path: "/",
};

export async function login(req, res, next) {
	try {
		const { user, token } = await loginWithCredentials(req.body.identifier ?? req.body.email, req.body.password);
		res.cookie("access_token", token, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
		return sendSuccess(res, "Signed in successfully", { user });
	} catch (error) {
		return next(error);
	}
}

export async function register(req, res, next) {
	try {
		const result = await registerAccount(req.body);
		return sendSuccess(res, "Registration received. Check your email to verify the address.", result, 202);
	} catch (error) { return next(error); }
}

export async function verifyEmail(req, res, next) {
	try { return sendSuccess(res, "Email address verified", await verifyEmailAddress(req.body.token)); } catch (error) { return next(error); }
}

export async function resendVerification(req, res, next) {
	try {
		await requestEmailVerification(req.body.email);
		return sendSuccess(res, "If the account can be verified, an email will be sent shortly", null, 202);
	} catch (error) { return next(error); }
}

export async function forgotPassword(req, res, next) {
	try {
		await requestPasswordReset(req.body.email);
		return sendSuccess(res, "If the account exists, password reset instructions will be sent shortly", null, 202);
	} catch (error) { return next(error); }
}

export async function resetPasswordController(req, res, next) {
	try { await resetPassword(req.body.token, req.body.password); return sendSuccess(res, "Password reset successfully", null); } catch (error) { return next(error); }
}

export function logout(req, res) {
	res.clearCookie("access_token", cookieOptions);
	return sendSuccess(res, "Signed out successfully", null);
}

export function getMe(req, res, next) {
	if (!req.user) return next(new AppError(401, "Authentication required"));
	return sendSuccess(res, "Authenticated user", { user: req.user });
}
