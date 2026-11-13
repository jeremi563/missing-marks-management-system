import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { AppError } from "../shared/utils/app-error.js";

export async function authenticate(req, res, next) {
	let claims;
	try {
		const bearerToken = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
		const token = req.cookies?.access_token ?? bearerToken;
		if (!token) throw new AppError(401, "Authentication required");
		claims = jwt.verify(token, env.JWT_SECRET);
	} catch (error) {
		return next(error instanceof AppError ? error : new AppError(401, "Invalid authentication credentials"));
	}

	try {
		const database = req.app?.locals?.prisma ?? prisma;
		const user = await database.user.findUnique({
			where: { id: claims.sub },
			select: {
				id: true,
				email: true,
				sessionVersion: true,
				pendingEmail: true,
				displayName: true,
				isActive: true,
				approvalStatus: true,
				roles: { select: { role: { select: { name: true } } } },
			},
		});
		const roles = user?.roles.map(({ role }) => role.name) ?? [];
		const isPendingLecturer = roles.includes("lecturer") && user?.approvalStatus === "PENDING" && !user?.isActive;
		const isApprovedUser = user?.isActive && user.approvalStatus === "APPROVED";
		if (!user || !(isApprovedUser || isPendingLecturer)
			|| (claims.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
			throw new AppError(401, "Invalid authentication credentials");
		}

		req.user = {
			id: user.id,
			email: user.email,
			sessionVersion: user.sessionVersion ?? 0,
			pendingEmail: user.pendingEmail,
			displayName: user.displayName,
			approvalStatus: user.approvalStatus,
			isActive: user.isActive,
			roles,
		};
		req.sessionExpiresAt = claims.exp ? new Date(claims.exp * 1000) : null;
		return next();
	} catch (error) {
		return next(error);
	}
}
