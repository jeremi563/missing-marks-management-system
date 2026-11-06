import { z } from "zod";

const uuid = z.string().uuid();
const page = z.coerce.number().int().min(1).optional().default(1);
const limit = z.coerce.number().int().min(1).max(100).optional().default(10);
const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));

export const settingsQuery = z.object({ page, limit }).strict();
export const settingKeyParams = z.object({ key: z.string().trim().min(1).max(100) }).strict();
export const settingUpdateBody = z.object({ value: z.unknown(), description: z.string().trim().max(500).optional() }).strict();

export const reportSummaryQuery = z.object({
	page,
	limit,
	status: z.string().trim().min(1).max(80).optional(),
	departmentId: uuid.optional(),
	courseUnitId: uuid.optional(),
	academicPeriodId: uuid.optional(),
	from: dateTime.optional(),
	to: dateTime.optional(),
}).strict().refine((query) => !query.from || !query.to || query.to >= query.from, {
	message: "The 'to' date must be on or after the 'from' date.",
	path: ["to"],
});

export const auditLogQuery = z.object({
	page,
	limit,
	action: z.string().trim().min(1).max(120).optional(),
	entityType: z.string().trim().min(1).max(120).optional(),
	actorId: uuid.optional(),
	from: dateTime.optional(),
	to: dateTime.optional(),
}).strict().refine((query) => !query.from || !query.to || query.to >= query.from, {
	message: "The 'to' date must be on or after the 'from' date.",
	path: ["to"],
});