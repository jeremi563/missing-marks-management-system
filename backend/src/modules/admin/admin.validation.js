import { z } from "zod";
import {
	isAdminRegistrationNumber,
	isStaffRegistrationNumber,
	isStudentRegistrationNumber,
} from "../../shared/utils/registration-number.js";

const roleNames = z.enum(["student", "lecturer", "cod", "administrator"]);
const studentNumber = z.string().trim().min(1).max(100).refine(isStudentRegistrationNumber, {
	message: "Use the student number format AB16/00111/26, with an admission year from 13 through the current year.",
});
const staffNumber = z.string().trim().min(1).max(100).refine(isStaffRegistrationNumber, {
	message: "Use the staff number format AB/0123/staffnumber.",
});
const adminNumber = z.string().trim().min(1).max(100).refine(isAdminRegistrationNumber, {
	message: "Use the administrator number format admin/12/year, with a year no later than the current year.",
});

export const userIdParams = z.object({
	id: z.string().uuid("A valid user UUID is required."),
}).strict();

export const userListQuery = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
	search: z.string().trim().min(1).max(254).optional(),
	role: roleNames.optional(),
	approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
	isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).strict();

export const createUserBody = z.object({
	email: z.string().trim().email().max(254),
	password: z.string().min(8).max(128),
	displayName: z.string().trim().min(1).max(200),
	roles: z.array(roleNames).min(1).max(2),
	studentNumber: studentNumber.optional(),
	staffNumber: staffNumber.optional(),
	adminNumber: adminNumber.optional(),
	departmentId: z.string().uuid("A valid department UUID is required.").optional(),
}).strict().refine((body) => new Set(body.roles).size === body.roles.length, {
	message: "Roles must not contain duplicates.",
	path: ["roles"],
}).refine((body) => {
	if (body.roles.includes("administrator")) {
		return body.roles.length === 1 && Boolean(body.adminNumber) && !body.studentNumber && !body.staffNumber && !body.departmentId;
	}
	return body.roles.includes("cod")
		&& body.roles.every((role) => role === "lecturer" || role === "cod")
		&& Boolean(body.staffNumber)
		&& !body.studentNumber
		&& !body.adminNumber
		&& Boolean(body.departmentId);
}, {
	message: "Only administrator and COD accounts can be created here; provide the matching account identifier.",
	path: ["roles"],
});

export const updateUserBody = z.object({
	email: z.string().trim().email().max(254).optional(),
	password: z.string().min(8).max(128).optional(),
	displayName: z.string().trim().min(1).max(200).optional(),
	studentNumber: studentNumber.optional(),
	isActive: z.boolean().optional(),
	roles: z.array(roleNames).min(1).max(2).optional(),
	departmentId: z.string().uuid("A valid department UUID is required.").optional(),
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
		studentNumber,
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
}).strict();