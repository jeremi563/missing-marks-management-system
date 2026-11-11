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
		const user = await prisma.user.findUnique({
			where: { id: claims.sub },
			include: { roles: { include: { role: true } } },
		});
		if (!user?.isActive || user.approvalStatus !== "APPROVED") throw new AppError(401, "Invalid authentication credentials");

		req.user = {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
			roles: user.roles.map(({ role }) => role.name),
		};
		return next();
	} catch (error) {
		return next(error);
	}
}
