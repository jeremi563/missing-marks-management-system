import { z } from "zod";

const roleNames = z.enum(["student", "lecturer", "cod", "administrator"]);

export const userIdParams = z.object({
	id: z.string().uuid("A valid user UUID is required."),
}).strict();

export const userListQuery = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
	search: z.string().trim().min(1).max(254).optional(),
	role: roleNames.optional(),
	isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).strict();

export const createUserBody = z.object({
	email: z.string().trim().email().max(254),
	password: z.string().min(12).max(128),
	displayName: z.string().trim().min(1).max(200),
	roles: z.array(roleNames).min(1).max(4),
	studentNumber: z.string().trim().min(1).max(100).optional(),
	staffNumber: z.string().trim().min(1).max(100).optional(),
}).strict().refine((body) => new Set(body.roles).size === body.roles.length, {
	message: "Roles must not contain duplicates.",
	path: ["roles"],
});

export const updateUserBody = z.object({
	email: z.string().trim().email().max(254).optional(),
	password: z.string().min(12).max(128).optional(),
	displayName: z.string().trim().min(1).max(200).optional(),
	isActive: z.boolean().optional(),
	roles: z.array(roleNames).min(1).max(4).optional(),
	studentNumber: z.string().trim().min(1).max(100).optional(),
	staffNumber: z.string().trim().min(1).max(100).optional(),
}).strict().refine((body) => Object.keys(body).length > 0, {
	message: "At least one user field must be provided.",
});