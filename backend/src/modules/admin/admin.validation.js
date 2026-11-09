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
	roles: z.array(roleNames).min(1).max(2),
	studentNumber: z.string().trim().min(1).max(100).optional(),
	staffNumber: z.string().trim().min(1).max(100).optional(),
	adminNumber: z.string().trim().min(1).max(100).optional(),
}).strict().refine((body) => new Set(body.roles).size === body.roles.length, {
	message: "Roles must not contain duplicates.",
	path: ["roles"],
}).refine((body) => body.roles.includes("student")
	? body.roles.length === 1 && Boolean(body.studentNumber) && !body.staffNumber && !body.adminNumber
	: body.roles.includes("administrator")
		? body.roles.length === 1 && Boolean(body.adminNumber) && !body.studentNumber && !body.staffNumber
		: body.roles.every((role) => role === "lecturer" || role === "cod") && Boolean(body.staffNumber) && !body.studentNumber && !body.adminNumber, {
	message: "Provide one identity number matching the selected account role(s).",
	path: ["roles"],
});

export const updateUserBody = z.object({
	email: z.string().trim().email().max(254).optional(),
	password: z.string().min(12).max(128).optional(),
	displayName: z.string().trim().min(1).max(200).optional(),
	isActive: z.boolean().optional(),
	roles: z.array(roleNames).min(1).max(2).optional(),
	studentNumber: z.string().trim().min(1).max(100).optional(),
	staffNumber: z.string().trim().min(1).max(100).optional(),
	adminNumber: z.string().trim().min(1).max(100).optional(),
}).strict().refine((body) => Object.keys(body).length > 0, {
	message: "At least one user field must be provided.",
}).refine((body) => !body.roles || ((!body.roles.includes("student") || (body.roles.length === 1 && !body.roles.includes("administrator")))
	&& (!body.roles.includes("administrator") || body.roles.length === 1)
	&& body.roles.every((role) => ["student", "lecturer", "cod", "administrator"].includes(role))), {
	message: "Student and administrator accounts cannot combine roles.",
	path: ["roles"],
});

export const rosterImportBody = z.object({
	students: z.array(z.object({
		studentNumber: z.string().trim().min(1).max(100),
		email: z.string().trim().email().max(254),
	}).strict()).min(1).max(1000),
}).strict().refine(({ students }) => new Set(students.map(({ studentNumber }) => studentNumber.toUpperCase())).size === students.length, {
	message: "Student registration numbers must be unique in the import.",
	path: ["students"],
}).refine(({ students }) => new Set(students.map(({ email }) => email.toLowerCase())).size === students.length, {
	message: "Student email addresses must be unique in the import.",
	path: ["students"],
});

export const accountApprovalBody = z.object({
	status: z.enum(["APPROVED", "REJECTED"]),
	roles: z.array(z.enum(["lecturer", "cod"])).min(1).max(2).optional(),
}).strict().refine(({ roles }) => !roles || new Set(roles).size === roles.length, {
	message: "Roles must not contain duplicates.",
	path: ["roles"],
});