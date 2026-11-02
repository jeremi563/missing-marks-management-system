import { z } from "zod";

const reportListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
}).strict();

export function validateReportListQuery(req, res, next) {
	const result = reportListQuerySchema.safeParse(req.query);
	if (!result.success) {
		return next(Object.assign(new Error("Request validation failed"), {
			statusCode: 400,
			details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
		}));
	}

	req.validatedQuery = result.data;
	return next();
}