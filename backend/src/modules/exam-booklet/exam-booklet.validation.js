import { z } from "zod";

const sessionParams = z.object({ sessionId: z.string().uuid() }).strict();
const bookletParams = z.object({ bookletId: z.string().uuid() }).strict();

export const studentBookletScanBody = z.object({
	sessionId: z.string().uuid(),
	token: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export const invigilatorBookletScanBody = z.object({
	token: z.string().regex(/^[a-f0-9]{64}$/i),
	identityConfirmed: z.literal(true),
}).strict();

export const invigilatorBookletPreviewBody = z.object({
	token: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export const manualBookletLookupBody = z.object({
	studentNumber: z.string().trim().min(1).max(80),
	identityConfirmed: z.literal(true),
}).strict();

export const replaceBookletBody = z.object({
	reason: z.string().trim().min(1).max(2000),
}).strict();

export const bookletHistoryQuery = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export function validateExamBookletSessionParams(req, res, next) {
	const result = sessionParams.safeParse(req.params);
	if (!result.success) return next(validationError(result.error));
	req.validatedParams = result.data;
	return next();
}

export function validateExamBookletParams(req, res, next) {
	const result = bookletParams.safeParse(req.params);
	if (!result.success) return next(validationError(result.error));
	req.validatedParams = result.data;
	return next();
}

export function validateExamBookletHistoryQuery(req, res, next) {
	const result = bookletHistoryQuery.safeParse(req.query);
	if (!result.success) return next(validationError(result.error));
	req.validatedQuery = result.data;
	return next();
}

function validationError(error) {
	return Object.assign(new Error("Request validation failed"), {
		statusCode: 400,
		details: error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
	});
}
