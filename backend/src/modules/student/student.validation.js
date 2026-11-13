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
	academicYear: z.string().regex(/^20\d{2}\/\d{2}$/, "Academic year must use the YYYY/YY format."),
	assessmentId: z.string().uuid().optional(),
	assessmentComponent: z.string().trim().min(1).max(100).optional(),
	description: z.string().trim().min(1).max(5000),
}).strict();

const updateReportBodySchema = z.object({
	assessmentId: z.string().uuid().optional(),
	assessmentComponent: z.string().trim().min(1).max(100).optional(),
	description: z.string().trim().min(1).max(5000).optional(),
}).strict().refine((body) => Object.keys(body).length > 0, "At least one report field must be provided.");

const createAppealBodySchema = z.object({
	reason: z.string().trim().min(1).max(5000),
	comments: z.string().trim().max(2000).optional(),
}).strict();

const studentCommentBodySchema = z.object({
	body: z.string().trim().min(1).max(2000),
}).strict();

const studentNotificationIdSchema = z.object({
	notificationId: z.string().uuid("A valid notification UUID is required."),
});
const attendanceDiscrepancySourceSchema = z.object({
	attendanceRecordId: z.string().uuid().optional(),
	assessmentAttendanceId: z.string().uuid().optional(),
	attendanceAttemptId: z.string().uuid().optional(),
	description: z.string().trim().min(1).max(2000),
}).strict().superRefine((body, context) => {
	if ([body.attendanceRecordId, body.assessmentAttendanceId, body.attendanceAttemptId].filter(Boolean).length !== 1) {
		context.addIssue({ code: "custom", path: [], message: "Exactly one attendance source is required." });
	}
});
const attendanceDiscrepancyParamsSchema = z.object({ id: z.string().uuid() });
const studentAttendanceCheckInSchema = z.object({
	token: z.string().regex(/^[a-f0-9]{64}$/i, "A valid attendance link token is required."),
	latitude: z.number().finite().min(-90).max(90),
	longitude: z.number().finite().min(-180).max(180),
	accuracyMeters: z.number().finite().min(0).max(20_000_000),
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

export function validateCreateStudentCommentBody(req, res, next) {
	const result = studentCommentBodySchema.safeParse(req.body);
	if (!result.success) {
		return next(Object.assign(new Error("Request validation failed"), {
			statusCode: 400,
			details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
		}));
	}

	req.validatedBody = result.data;
	return next();
}

export function validateStudentNotificationId(req, res, next) {
	const result = studentNotificationIdSchema.safeParse(req.params);
	if (!result.success) {
		return next(Object.assign(new Error("Request validation failed"), {
			statusCode: 400,
			details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
		}));
	}

	req.validatedParams = result.data;
	return next();
}

export function validateAttendanceDiscrepancySource(req, res, next) {
	const result = attendanceDiscrepancySourceSchema.safeParse(req.body);
	if (!result.success) return next(Object.assign(new Error("Request validation failed"), { statusCode: 400, details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }));
	req.validatedBody = result.data;
	return next();
}

export function validateAttendanceDiscrepancyParams(req, res, next) {
	const result = attendanceDiscrepancyParamsSchema.safeParse(req.params);
	if (!result.success) return next(Object.assign(new Error("Request validation failed"), { statusCode: 400, details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }));
	req.validatedParams = result.data;
	return next();
}

export function validateStudentAttendanceCheckIn(req, res, next) {
	const result = studentAttendanceCheckInSchema.safeParse(req.body);
	if (!result.success) return next(Object.assign(new Error("Request validation failed"), { statusCode: 400, details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })) }));
	req.validatedBody = result.data;
	return next();
}
