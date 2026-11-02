import { z } from "zod";

const reportListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
}).strict();

const studentReportIdSchema = z.object({
	reportId: z.string().uuid("A valid report UUID is required."),
});

const createReportBodySchema = z.object({
	courseUnitId: z.string().uuid(),
	academicPeriodId: z.string().uuid(),
	assessmentId: z.string().uuid().optional(),
	assessmentComponent: z.string().trim().min(1).max(100),
	description: z.string().trim().min(1).max(5000),
}).strict();

const updateReportBodySchema = z.object({
	assessmentId: z.string().uuid().optional(),
	assessmentComponent: z.string().trim().min(1).max(100).optional(),
	description: z.string().trim().min(1).max(5000).optional(),
}).strict();

const createAppealBodySchema = z.object({
	reason: z.string().trim().min(1).max(5000),
	comments: z.string().trim().max(2000).optional(),
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

export function validateStudentReportId(req, res, next) {
	const result = studentReportIdSchema.safeParse(req.params);
	if (!result.success) {
		return next(Object.assign(new Error("Request validation failed"), {
			statusCode: 400,
			details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
		}));
	}

	req.validatedParams = result.data;
	return next();
}
export function validateUpdateReportBody(req, res, next) {
	const result = updateReportBodySchema.safeParse(req.body);
	if (!result.success) {
		return next(Object.assign(new Error("Request validation failed"), {
			statusCode: 400,
			details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
		}));
	}

	req.validatedBody = result.data;
	return next();
}
export function validateCreateReportBody(req, res, next) {
	const result = createReportBodySchema.safeParse(req.body);
	if (!result.success) {
		return next(Object.assign(new Error("Request validation failed"), {
			statusCode: 400,
			details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
		}));
	}

	req.validatedBody = result.data;
	return next();
}

export function validateCreateAppealBody(req, res, next) {
	const result = createAppealBodySchema.safeParse(req.body);
	if (!result.success) {
		return next(Object.assign(new Error("Request validation failed"), {
			statusCode: 400,
			details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
		}));
	}

	req.validatedBody = result.data;
	return next();
}