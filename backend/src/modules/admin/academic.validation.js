import { z } from "zod";

const uuid = z.string().uuid();
const pageQuery = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
}).strict();
const idParams = z.object({ id: uuid }).strict();

const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const dateRange = (schema) => schema.refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, {
	message: "The end date must be later than the start date.",
	path: ["endsAt"],
});

export const departmentListQuery = pageQuery;
export const departmentIdParams = idParams;
export const departmentOnlyParams = z.object({ departmentId: uuid }).strict();
export const departmentMemberParams = z.object({ departmentId: uuid, userId: uuid }).strict();
export const departmentMemberListQuery = pageQuery.extend({ role: z.enum(["lecturer", "cod", "administrator"]).optional() }).strict();
export const departmentMemberBody = z.object({ userId: uuid }).strict();
const departmentInitials = z.string().trim().regex(/^[A-Z]{2}$/, "Department initials must be exactly two uppercase letters");
export const departmentCreateBody = z.object({ name: z.string().trim().min(1).max(200), initials: departmentInitials, code: z.string().trim().min(1).max(50).optional() }).strict();
export const departmentUpdateBody = z.object({ name: z.string().trim().min(1).max(200).optional(), initials: departmentInitials.optional(), code: z.string().trim().min(1).max(50).nullable().optional() }).strict().refine((body) => Object.keys(body).length > 0, "At least one department field must be provided.");

export const courseListQuery = pageQuery.extend({ departmentId: uuid.optional() }).strict();
export const courseCreateBody = z.object({ departmentId: uuid, code: z.string().regex(/^\d{2}$/, "Course identifier must be two digits"), name: z.string().trim().min(1).max(200) }).strict();
export const courseUnitListQuery = pageQuery.extend({ departmentId: uuid.optional(), courseId: uuid.optional() }).strict();
export const courseUnitIdParams = idParams;
export const courseUnitCreateBody = z.object({ courseId: uuid, code: z.string().trim().min(1).max(50), name: z.string().trim().min(1).max(200) }).strict();
export const courseUnitUpdateBody = z.object({ courseId: uuid.optional(), code: z.string().trim().min(1).max(50).optional(), name: z.string().trim().min(1).max(200).optional() }).strict().refine((body) => Object.keys(body).length > 0, "At least one course-unit field must be provided.");

export const academicPeriodListQuery = pageQuery;
export const academicPeriodIdParams = idParams;
const enrollmentWindow = (schema) => schema.refine((value) =>
	!value.enrollmentOpensAt || !value.enrollmentClosesAt || value.enrollmentClosesAt > value.enrollmentOpensAt, {
		message: "The enrollment closing date must be later than its opening date.",
		path: ["enrollmentClosesAt"],
	});
export const academicPeriodCreateBody = enrollmentWindow(dateRange(z.object({
	code: z.string().trim().min(1).max(80).optional(),
	name: z.string().trim().min(1).max(200),
	startsAt: dateTime.optional(),
	endsAt: dateTime.optional(),
	enrollmentOpensAt: dateTime.optional(),
	enrollmentClosesAt: dateTime.optional(),
}).strict())).refine(({ enrollmentOpensAt, enrollmentClosesAt }) =>
	Boolean(enrollmentOpensAt) === Boolean(enrollmentClosesAt), {
	message: "Set both enrollment window dates, or leave both unset.",
	path: ["enrollmentClosesAt"],
});
export const academicPeriodUpdateBody = enrollmentWindow(dateRange(z.object({
	code: z.string().trim().min(1).max(80).nullable().optional(),
	name: z.string().trim().min(1).max(200).optional(),
	startsAt: dateTime.nullable().optional(),
	endsAt: dateTime.nullable().optional(),
	enrollmentOpensAt: dateTime.nullable().optional(),
	enrollmentClosesAt: dateTime.nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0, "At least one academic-period field must be provided.")));

export const enrollmentListQuery = pageQuery.extend({ studentProfileId: uuid.optional(), courseUnitId: uuid.optional(), academicPeriodId: uuid.optional() }).strict();
export const enrollmentIdParams = idParams;

export const mappingListQuery = pageQuery.extend({ courseUnitId: uuid.optional(), lecturerProfileId: uuid.optional(), academicYear: z.string().regex(/^20\d{2}\/\d{2}$/).optional() }).strict();
export const mappingIdParams = idParams;
export const classroomListQuery = pageQuery;
export const classroomIdParams = idParams;
export const classroomCreateBody = z.object({ name: z.string().trim().min(1).max(200), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180), boundaryMeters: z.number().int().min(1).max(10000), isActive: z.boolean().optional() }).strict();
export const classroomUpdateBody = classroomCreateBody.partial().refine((body) => Object.keys(body).length > 0, "At least one classroom field must be provided.");

export const assessmentListQuery = pageQuery.extend({ courseUnitId: uuid.optional(), type: z.string().trim().min(1).max(80).optional() }).strict();
export const assessmentIdParams = idParams;
export const assessmentCreateBody = z.object({ courseUnitId: uuid, code: z.string().trim().min(1).max(80).optional(), name: z.string().trim().min(1).max(200), type: z.string().trim().min(1).max(80), assessmentDate: dateTime.optional(), maximumMarks: z.number().finite().min(0).max(999999.99).optional(), requiredForEligibility: z.boolean().optional(), attendanceRequired: z.boolean().optional(), submissionRequired: z.boolean().optional() }).strict();
export const assessmentUpdateBody = assessmentCreateBody.omit({ courseUnitId: true }).partial().refine((body) => Object.keys(body).length > 0, "At least one assessment field must be provided.");

export const assessmentTypeListQuery = pageQuery.extend({ isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional() }).strict();
export const assessmentTypeIdParams = idParams;
export const assessmentTypeCreateBody = z.object({ code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(200), isActive: z.boolean().optional() }).strict();
export const assessmentTypeUpdateBody = assessmentTypeCreateBody.partial().refine((body) => Object.keys(body).length > 0, "At least one assessment-type field must be provided.");