import { env } from "../../config/env.js";
import { sendSuccess } from "../../shared/utils/api-response.js";
import { AppError } from "../../shared/utils/app-error.js";
import {
	loginWithCredentials,
	registerAccount,
	listRegistrationDepartments,
	completeLecturerDepartmentRegistration,
	requestEmailVerification,
	verifyEmailAddress,
	requestPasswordReset,
	resetPassword,
	changePassword,
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
		const message = result.requiresDepartmentRegistration
			? "Initial registration received. Complete the lecturer department form before your department COD can review the application."
			: "Registration successful. You can now sign in with your registration number and password.";
		return sendSuccess(res, message, result, 202);
	} catch (error) { return next(error); }
}

export async function getRegistrationDepartments(req, res, next) {
	try { return sendSuccess(res, "Registration departments retrieved successfully", await listRegistrationDepartments(req.app.locals.prisma)); } catch (error) { return next(error); }
}

export async function registerLecturerDepartment(req, res, next) {
	try {
		const result = await completeLecturerDepartmentRegistration(req.body, req.app.locals.prisma);
		return sendSuccess(res, "Lecturer department registration received", result, 202);
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

export async function changePasswordController(req, res, next) {
	try {
		await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
		return sendSuccess(res, "Password changed successfully", null);
	} catch (error) { return next(error); }
}

export function logout(req, res) {
	res.clearCookie("access_token", cookieOptions);
	return sendSuccess(res, "Signed out successfully", null);
}

export function getMe(req, res, next) {
	if (!req.user) return next(new AppError(401, "Authentication required"));
	return sendSuccess(res, "Authenticated user", { user: req.user });
}
