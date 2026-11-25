import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { decideCodReport, decideLecturerApproval, getCodComments, getCodReport, getCodReports, getPendingLecturerApprovals, postCodComment, getCodDepartmentCourseUnits, getCodDepartmentStudents, getCodDepartmentLecturers, getCodDepartments, postCodCourseUnitLecturer, postCodReportReassignment } from "./cod.controller.js";
import { codCourseUnitParamsSchema, codDirectoryQuerySchema, codReportDecisionBodySchema, codReportIdParamsSchema, codReportReassignmentBodySchema, createCodCourseUnitLecturerBodySchema, createCodReportCommentBodySchema, getCodReportsQuerySchema, lecturerApprovalDecisionBodySchema, lecturerApprovalIdParamsSchema } from "./cod.validation.js";
import { feature5CodRoutes } from "../feature5/cod.routes.js";
import { getCodAttendanceDiscrepancies, getCodAttendanceDiscrepancyById, getCodAttendanceDiscrepancyDecisions, postCodAttendanceDiscrepancyDecision, postCodLegacyAttendanceRevalidation } from "./attendance-discrepancy.controller.js";
import { attendanceDiscrepancyIdParamsSchema, attendanceDiscrepancyListQuerySchema, codAttendanceDiscrepancyDecisionBodySchema, codLegacyAttendanceRevalidationBodySchema } from "./attendance-discrepancy.validation.js";
import { getCodAssessmentAttendance, getCodAttendanceAttempts, getCodAttendanceDiscrepancyAudit, getCodAttendanceHistory, getCodAttendanceRecords, getCodAttendanceStatistics, getCodAttendanceSummary } from "./attendance-history.controller.js";
import { codAttendanceAggregateQuerySchema, codAttendanceAttemptsQuerySchema, codAttendanceRecordIdParamsSchema, codAttendanceRecordsQuerySchema, codAssessmentAttendanceQuerySchema } from "./cod.validation.js";
import { getEnrollmentRequestsForReviewer, postEnrollmentRequestDecision } from "../enrollment/enrollment-request.controller.js";
import { enrollmentRequestDecisionBody, enrollmentRequestListQuery } from "../enrollment/enrollment-request.validation.js";
import { getCodDepartmentRequests, patchCodDepartmentRequestDecision } from "../department-membership/department-membership.controller.js";
import { departmentMembershipDecisionBody, departmentMembershipRequestParams } from "../department-membership/department-membership.validation.js";
import { getUserNotifications, patchAllUserNotificationsRead, patchUserNotificationRead } from "../../shared/controllers/user-notifications.controller.js";
import { userNotificationIdParams, userNotificationsQuery } from "../../shared/validation/user-notifications.validation.js";
import {
	getCodMarkCorrectionController,
	getCodMarkCorrectionsController,
	postCodMarkCorrectionDecisionController,
} from "../marks/marks.controller.js";
import { codCorrectionsQuery, correctionDecisionBody, correctionParams } from "../marks/marks.validation.js";
import { examBookletScanRateLimit } from "../exam-booklet/exam-booklet.rate-limit.js";
import { postCodExamBookletReplacement } from "../exam-booklet/exam-booklet.controller.js";
import { replaceBookletBody, validateExamBookletParams } from "../exam-booklet/exam-booklet.validation.js";
import { resourceIntensiveRateLimit, sensitiveOperationRateLimit } from "../../middleware/rate-limit.js";

export const codRoutes = Router();

codRoutes.use(authenticate);
codRoutes.use(authorize("cod"));
codRoutes.get("/notifications", validate(userNotificationsQuery, "query"), getUserNotifications);
codRoutes.patch("/notifications/read-all", patchAllUserNotificationsRead);
codRoutes.patch("/notifications/:notificationId/read", validate(userNotificationIdParams, "params"), patchUserNotificationRead);
codRoutes.get("/pending-lecturer-approvals", getPendingLecturerApprovals);
codRoutes.get("/enrollment-requests", validate(enrollmentRequestListQuery, "query"), getEnrollmentRequestsForReviewer);
codRoutes.post("/enrollment-requests/decision", sensitiveOperationRateLimit, validate(enrollmentRequestDecisionBody), postEnrollmentRequestDecision);
codRoutes.get("/lecturer-department-requests", getCodDepartmentRequests);
codRoutes.patch("/lecturer-department-requests/:id", sensitiveOperationRateLimit, validate(departmentMembershipRequestParams, "params"), validate(departmentMembershipDecisionBody), patchCodDepartmentRequestDecision);
codRoutes.patch("/lecturer-approvals/:id", sensitiveOperationRateLimit, validate(lecturerApprovalIdParamsSchema, "params"), validate(lecturerApprovalDecisionBodySchema), decideLecturerApproval);
codRoutes.get("/departments", getCodDepartments);
codRoutes.get("/course-units", validate(codDirectoryQuerySchema, "query"), getCodDepartmentCourseUnits);
codRoutes.get("/mark-corrections", resourceIntensiveRateLimit, validate(codCorrectionsQuery, "query"), getCodMarkCorrectionsController);
codRoutes.get("/mark-corrections/:correctionId", validate(correctionParams, "params"), getCodMarkCorrectionController);
codRoutes.post("/mark-corrections/:correctionId/decision", sensitiveOperationRateLimit, validate(correctionParams, "params"), validate(correctionDecisionBody), postCodMarkCorrectionDecisionController);
codRoutes.get("/students", validate(codDirectoryQuerySchema, "query"), getCodDepartmentStudents);
codRoutes.get("/lecturers", validate(codDirectoryQuerySchema, "query"), getCodDepartmentLecturers);
codRoutes.post("/course-units/:courseUnitId/lecturers", validate(codCourseUnitParamsSchema, "params"), validate(createCodCourseUnitLecturerBodySchema), postCodCourseUnitLecturer);
codRoutes.post("/exam-booklets/:bookletId/replacements", examBookletScanRateLimit, validateExamBookletParams, validate(replaceBookletBody), postCodExamBookletReplacement);
codRoutes.get("/attendance-records", resourceIntensiveRateLimit, validate(codAttendanceRecordsQuerySchema, "query"), getCodAttendanceRecords);
codRoutes.get("/assessment-attendance", resourceIntensiveRateLimit, validate(codAssessmentAttendanceQuerySchema, "query"), getCodAssessmentAttendance);
codRoutes.get("/attendance-attempts", resourceIntensiveRateLimit, validate(codAttendanceAttemptsQuerySchema, "query"), getCodAttendanceAttempts);
codRoutes.get("/attendance-records/:id/history", validate(codAttendanceRecordIdParamsSchema, "params"), getCodAttendanceHistory);
codRoutes.get("/attendance-discrepancies/:id/audit", validate(attendanceDiscrepancyIdParamsSchema, "params"), getCodAttendanceDiscrepancyAudit);
codRoutes.get("/attendance-summary", resourceIntensiveRateLimit, validate(codAttendanceAggregateQuerySchema, "query"), getCodAttendanceSummary);
codRoutes.get("/attendance-statistics", resourceIntensiveRateLimit, validate(codAttendanceAggregateQuerySchema, "query"), getCodAttendanceStatistics);
codRoutes.get("/attendance-discrepancies", validate(attendanceDiscrepancyListQuerySchema, "query"), getCodAttendanceDiscrepancies);
codRoutes.get("/attendance-discrepancies/:id", validate(attendanceDiscrepancyIdParamsSchema, "params"), getCodAttendanceDiscrepancyById);
codRoutes.get("/attendance-discrepancies/:id/decisions", validate(attendanceDiscrepancyIdParamsSchema, "params"), getCodAttendanceDiscrepancyDecisions);
codRoutes.post("/attendance-discrepancies/:id/decisions", sensitiveOperationRateLimit, validate(attendanceDiscrepancyIdParamsSchema, "params"), validate(codAttendanceDiscrepancyDecisionBodySchema), postCodAttendanceDiscrepancyDecision);
codRoutes.post("/attendance-discrepancies/:id/revalidate-legacy-authorization", sensitiveOperationRateLimit, validate(attendanceDiscrepancyIdParamsSchema, "params"), validate(codLegacyAttendanceRevalidationBodySchema), postCodLegacyAttendanceRevalidation);
codRoutes.use(feature5CodRoutes);
codRoutes.get("/reports", validate(getCodReportsQuerySchema, "query"), getCodReports);
codRoutes.get("/reports/:id", validate(codReportIdParamsSchema, "params"), getCodReport);
codRoutes.get("/reports/:id/comments", validate(codReportIdParamsSchema, "params"), getCodComments);
codRoutes.post(
  "/reports/:id/comments",
  validate(codReportIdParamsSchema, "params"),
  validate(createCodReportCommentBodySchema, "body"),
  postCodComment,
);
codRoutes.post(
  "/reports/:id/decision",
  sensitiveOperationRateLimit,
  validate(codReportIdParamsSchema, "params"),
  validate(codReportDecisionBodySchema, "body"),
  decideCodReport,
);
codRoutes.post(
  "/reports/:id/reassign",
  sensitiveOperationRateLimit,
  validate(codReportIdParamsSchema, "params"),
  validate(codReportReassignmentBodySchema),
  postCodReportReassignment,
);
