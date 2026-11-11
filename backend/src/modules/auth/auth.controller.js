import { env } from "../../config/env.js";
import { sendSuccess } from "../../shared/utils/api-response.js";
import { AppError } from "../../shared/utils/app-error.js";
import { loginWithCredentials } from "./auth.service.js";

const cookieOptions = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: "strict",
	path: "/",
};

export async function login(req, res, next) {
	try {
		const { user, token } = await loginWithCredentials(req.body.email, req.body.password);
		res.cookie("access_token", token, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
		return sendSuccess(res, "Signed in successfully", { user });
	} catch (error) {
		return next(error);
	}
}

export function logout(req, res) {
	res.clearCookie("access_token", cookieOptions);
	return sendSuccess(res, "Signed out successfully", null);
}

export function getMe(req, res, next) {
	if (!req.user) return next(new AppError(401, "Authentication required"));
	return sendSuccess(res, "Authenticated user", { user: req.user });
}
