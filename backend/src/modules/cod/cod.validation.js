import { z } from "zod";

export const lecturerApprovalIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const codCourseUnitParamsSchema = z.object({ courseUnitId: z.string().uuid() }).strict();
export const lecturerApprovalDecisionBodySchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) }).strict();
export const createCodCourseUnitLecturerBodySchema = z.object({
  departmentId: z.string().uuid(),
  lecturerProfileId: z.string().uuid(),
}).strict();
export const codDirectoryQuerySchema = z.object({
  departmentId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const getCodReportsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  status: z.literal("ESCALATED").default("ESCALATED"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "status", "studentNumber"]).default("newest"),
});

export const codReportIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createCodReportCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

export const codReportDecisionBodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().min(1).max(2000),
}).strict();

const dateString = z.iso.datetime({ offset: true });
const attendanceQueryFields = {
  departmentId: z.string().uuid().optional(),
  courseUnitId: z.string().uuid().optional(),
  studentProfileId: z.string().uuid().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
function withValidDateRange(schema) {
  return schema.refine(({ from, to }) => !from || !to || new Date(from) <= new Date(to), {
    message: "from must be earlier than or equal to to",
    path: ["to"],
  });
}

export const codAttendanceRecordsQuerySchema = withValidDateRange(z.object({
  ...attendanceQueryFields,
  status: z.string().trim().min(1).max(60).optional(),
}));
export const codAssessmentAttendanceQuerySchema = withValidDateRange(z.object({
  ...attendanceQueryFields,
  status: z.string().trim().min(1).max(60).optional(),
}));
export const codAttendanceAttemptsQuerySchema = withValidDateRange(z.object({
  ...attendanceQueryFields,
  outcome: z.string().trim().min(1).max(60).optional(),
}));
export const codAttendanceAggregateQuerySchema = withValidDateRange(z.object({
  departmentId: attendanceQueryFields.departmentId,
  courseUnitId: attendanceQueryFields.courseUnitId,
  from: attendanceQueryFields.from,
  to: attendanceQueryFields.to,
}));
export const codAttendanceRecordIdParamsSchema = z.object({ id: z.string().uuid() });
