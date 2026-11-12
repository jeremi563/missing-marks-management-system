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
	requestEmailChange,
	updateAvatar,
	extendSession,
} from "./auth.service.js";

const cookieOptions = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: "strict",
	path: "/",
};
const sessionCookieMaxAge = 15 * 60 * 1000;

function setSessionCookie(res, token) {
	res.cookie("access_token", token, { ...cookieOptions, maxAge: sessionCookieMaxAge });
}

export async function login(req, res, next) {
	try {
		const { user, token, sessionExpiresAt } = await loginWithCredentials(req.body.identifier ?? req.body.email, req.body.password);
		setSessionCookie(res, token);
		return sendSuccess(res, "Signed in successfully", { user, sessionExpiresAt });
	} catch (error) {
		return next(error);
	}
}

export function extendSessionController(req, res, next) {
	try {
		const { token, sessionExpiresAt } = extendSession(req.user);
		setSessionCookie(res, token);
		return sendSuccess(res, "Session extended successfully", { sessionExpiresAt });
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

export async function changeEmailController(req, res, next) {
	try {
		const result = await requestEmailChange(req.user.id, req.body.email, req.body.currentPassword);
		return sendSuccess(res, "Verify your new email address to finish the change", result);
	} catch (error) { return next(error); }
}

export async function updateAvatarController(req, res, next) {
	try {
		const result = await updateAvatar(req.user.id, req.body.avatarData);
		return sendSuccess(res, "Profile picture updated", result);
	} catch (error) { return next(error); }
}

export function logout(req, res) {
	res.clearCookie("access_token", cookieOptions);
	return sendSuccess(res, "Signed out successfully", null);
}

export async function getMe(req, res, next) {
	if (!req.user) return next(new AppError(401, "Authentication required"));
	try {
		const profile = await req.app.locals.prisma.user.findUnique({
			where: { id: req.user.id },
			select: {
				avatarData: true,
				departmentMemberships: {
					select: { department: { select: { id: true, name: true, code: true } } },
					orderBy: { department: { name: "asc" } },
				},
				designatedDepartments: {
					select: { id: true, name: true, code: true },
					orderBy: { name: "asc" },
				},
			},
		});
		return sendSuccess(res, "Authenticated user", {
			user: {
				...req.user,
				avatarData: profile?.avatarData ?? null,
				departmentMemberships: profile?.departmentMemberships ?? [],
				designatedDepartments: profile?.designatedDepartments ?? [],
			},
			sessionExpiresAt: req.sessionExpiresAt?.toISOString() ?? null,
		});
	} catch (error) { return next(error); }
}
