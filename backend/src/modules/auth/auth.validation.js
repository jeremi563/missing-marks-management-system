import { z } from "zod";

export const loginSchema = z.object({
	identifier: z.string().trim().min(1).max(254).optional(),
	email: z.string().trim().email().max(254).optional(),
	password: z.string().min(1).max(128),
}).strict().refine((body) => Boolean(body.identifier) !== Boolean(body.email), {
	message: "Provide exactly one login identifier.",
	path: ["identifier"],
});

export const registerSchema = z.object({
	role: z.enum(["student", "lecturer", "cod"]),
	email: z.string().trim().email().max(254),
	password: z.string().min(12).max(128),
	displayName: z.string().trim().min(1).max(200).optional(),
	studentNumber: z.string().trim().min(1).max(100).optional(),
	staffNumber: z.string().trim().min(1).max(100).optional(),
}).strict().refine((body) => body.role === "student"
	? Boolean(body.studentNumber) && !body.staffNumber
	: Boolean(body.staffNumber) && !body.studentNumber, {
	message: "Provide only the identifier required for the selected account type.",
	path: ["role"],
});

export const emailBodySchema = z.object({
	email: z.string().trim().email().max(254),
}).strict();

export const tokenBodySchema = z.object({
	token: z.string().min(32).max(256),
}).strict();

export const passwordResetSchema = tokenBodySchema.extend({
	password: z.string().min(12).max(128),
}).strict();