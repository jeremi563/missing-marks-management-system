import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { decideCodReport, decideLecturerApproval, getCodComments, getCodReport, getCodReports, getPendingLecturerApprovals, postCodComment, getCodDepartmentCourseUnits, getCodDepartmentStudents, getCodDepartmentLecturers, getCodDepartments, postCodCourseUnitLecturer } from "./cod.controller.js";
import { codCourseUnitParamsSchema, codDirectoryQuerySchema, codReportDecisionBodySchema, codReportIdParamsSchema, createCodCourseUnitLecturerBodySchema, createCodReportCommentBodySchema, getCodReportsQuerySchema, lecturerApprovalDecisionBodySchema, lecturerApprovalIdParamsSchema } from "./cod.validation.js";
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

export const codRoutes = Router();

codRoutes.use(authenticate);
codRoutes.use(authorize("cod"));
codRoutes.get("/notifications", validate(userNotificationsQuery, "query"), getUserNotifications);
codRoutes.patch("/notifications/read-all", patchAllUserNotificationsRead);
codRoutes.patch("/notifications/:notificationId/read", validate(userNotificationIdParams, "params"), patchUserNotificationRead);
codRoutes.get("/pending-lecturer-approvals", getPendingLecturerApprovals);
codRoutes.get("/enrollment-requests", validate(enrollmentRequestListQuery, "query"), getEnrollmentRequestsForReviewer);
codRoutes.post("/enrollment-requests/decision", validate(enrollmentRequestDecisionBody), postEnrollmentRequestDecision);
codRoutes.get("/lecturer-department-requests", getCodDepartmentRequests);
codRoutes.patch("/lecturer-department-requests/:id", validate(departmentMembershipRequestParams, "params"), validate(departmentMembershipDecisionBody), patchCodDepartmentRequestDecision);
codRoutes.patch("/lecturer-approvals/:id", validate(lecturerApprovalIdParamsSchema, "params"), validate(lecturerApprovalDecisionBodySchema), decideLecturerApproval);
codRoutes.get("/departments", getCodDepartments);
codRoutes.get("/course-units", validate(codDirectoryQuerySchema, "query"), getCodDepartmentCourseUnits);
codRoutes.get("/students", validate(codDirectoryQuerySchema, "query"), getCodDepartmentStudents);
codRoutes.get("/lecturers", validate(codDirectoryQuerySchema, "query"), getCodDepartmentLecturers);
codRoutes.post("/course-units/:courseUnitId/lecturers", validate(codCourseUnitParamsSchema, "params"), validate(createCodCourseUnitLecturerBodySchema), postCodCourseUnitLecturer);
codRoutes.get("/attendance-records", validate(codAttendanceRecordsQuerySchema, "query"), getCodAttendanceRecords);
codRoutes.get("/assessment-attendance", validate(codAssessmentAttendanceQuerySchema, "query"), getCodAssessmentAttendance);
codRoutes.get("/attendance-attempts", validate(codAttendanceAttemptsQuerySchema, "query"), getCodAttendanceAttempts);
codRoutes.get("/attendance-records/:id/history", validate(codAttendanceRecordIdParamsSchema, "params"), getCodAttendanceHistory);
codRoutes.get("/attendance-discrepancies/:id/audit", validate(attendanceDiscrepancyIdParamsSchema, "params"), getCodAttendanceDiscrepancyAudit);
codRoutes.get("/attendance-summary", validate(codAttendanceAggregateQuerySchema, "query"), getCodAttendanceSummary);
codRoutes.get("/attendance-statistics", validate(codAttendanceAggregateQuerySchema, "query"), getCodAttendanceStatistics);
codRoutes.get("/attendance-discrepancies", validate(attendanceDiscrepancyListQuerySchema, "query"), getCodAttendanceDiscrepancies);
codRoutes.get("/attendance-discrepancies/:id", validate(attendanceDiscrepancyIdParamsSchema, "params"), getCodAttendanceDiscrepancyById);
codRoutes.get("/attendance-discrepancies/:id/decisions", validate(attendanceDiscrepancyIdParamsSchema, "params"), getCodAttendanceDiscrepancyDecisions);
codRoutes.post("/attendance-discrepancies/:id/decisions", validate(attendanceDiscrepancyIdParamsSchema, "params"), validate(codAttendanceDiscrepancyDecisionBodySchema), postCodAttendanceDiscrepancyDecision);
codRoutes.post("/attendance-discrepancies/:id/revalidate-legacy-authorization", validate(attendanceDiscrepancyIdParamsSchema, "params"), validate(codLegacyAttendanceRevalidationBodySchema), postCodLegacyAttendanceRevalidation);
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
  validate(codReportIdParamsSchema, "params"),
  validate(codReportDecisionBodySchema, "body"),
  decideCodReport,
);
