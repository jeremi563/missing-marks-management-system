import { z } from "zod";
import {
	isAdminRegistrationNumber,
	isStaffRegistrationNumber,
} from "../../shared/utils/registration-number.js";

const publicRegistrationNumber = z.string().trim().min(1).max(100).refine(
	isStaffRegistrationNumber,
	{ message: "Public registration is for lecturers using a staff number in the format AB/0123/staffnumber." },
).refine((value) => !isAdminRegistrationNumber(value), {
	message: "Administrator accounts can only be created by an administrator.",
});

export const loginSchema = z.object({
	identifier: z.string().trim().min(1).max(100),
	password: z.string().min(1).max(128),
}).strict();

export const registerSchema = z.object({
	email: z.string().trim().email().max(254),
	password: z.string().min(8).max(128),
	displayName: z.string().trim().min(1).max(200),
	registrationNumber: publicRegistrationNumber,
}).strict();

export const lecturerDepartmentRegistrationSchema = z.object({
	email: z.string().trim().email().max(254),
	password: z.string().min(8).max(128),
	displayName: z.string().trim().min(1).max(200),
	registrationNumber: z.string().trim().min(1).max(100).refine(isStaffRegistrationNumber, {
		message: "Use the staff number format AB/0123/staffnumber.",
	}),
	departmentIds: z.array(z.string().uuid()).min(1).max(50),
	primaryDepartmentId: z.string().uuid(),
}).strict().superRefine(({ departmentIds, primaryDepartmentId }, context) => {
	if (new Set(departmentIds).size !== departmentIds.length) {
		context.addIssue({ code: "custom", path: ["departmentIds"], message: "Departments must be unique." });
	}
	if (!departmentIds.includes(primaryDepartmentId)) {
		context.addIssue({ code: "custom", path: ["primaryDepartmentId"], message: "Choose the primary department from your selected departments." });
	}
});

export const emailBodySchema = z.object({
	email: z.string().trim().email().max(254),
}).strict();

export const tokenBodySchema = z.object({
	token: z.string().min(32).max(256),
}).strict();

export const passwordResetSchema = tokenBodySchema.extend({
	password: z.string().min(8).max(128),
}).strict();

export const passwordChangeSchema = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: z.string().min(8).max(128),
}).strict();

export const emailChangeSchema = z.object({
	email: z.string().trim().email().max(254),
	currentPassword: z.string().min(1).max(128),
}).strict();

export const avatarUpdateSchema = z.object({
	avatarData: z.string().max(700_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).nullable(),
}).strict();