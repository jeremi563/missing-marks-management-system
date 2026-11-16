import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";

export async function loginWithCredentials(email, password) {
	const normalizedEmail = email.trim().toLowerCase();
	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
		include: { roles: { include: { role: true } } },
	});

	if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
		throw new AppError(401, "Invalid email or password");
	}

	const roles = user.roles.map(({ role }) => role.name);
	const token = jwt.sign({ roles }, env.JWT_SECRET, { subject: user.id, expiresIn: "15m" });
	return {
		token,
		user: { id: user.id, email: user.email, displayName: user.displayName, roles },
	};
}
