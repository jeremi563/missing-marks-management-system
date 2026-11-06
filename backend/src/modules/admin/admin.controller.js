import { sendSuccess } from "../../shared/utils/api-response.js";
import { createAdminUser, listAdminUsers, updateAdminUser } from "./admin.service.js";

export async function getUsers(req, res, next) {
	try {
		const result = await listAdminUsers({ db: req.app.locals.prisma, ...req.validatedQuery });
		return sendSuccess(res, "Administrator users retrieved successfully", result.users, 200, result.pagination);
	} catch (error) { return next(error); }
}

export async function createUser(req, res, next) {
	try {
		const user = await createAdminUser({ db: req.app.locals.prisma, actorUserId: req.user.id, ...req.validatedBody });
		return sendSuccess(res, "User created successfully", user, 201);
	} catch (error) { return next(error); }
}

export async function updateUser(req, res, next) {
	try {
		const user = await updateAdminUser({ db: req.app.locals.prisma, actorUserId: req.user.id, userId: req.validatedParams.id, ...req.validatedBody });
		return sendSuccess(res, "User updated successfully", user);
	} catch (error) { return next(error); }
}