import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { assignCodReport, decideCodReport, decideLecturerApproval, getCodComments, getCodEligibleLecturers, getCodReport, getCodReports, getPendingLecturerApprovals, postCodComment } from "./cod.controller.js";
import { assignCodReportBodySchema, codReportDecisionBodySchema, codReportIdParamsSchema, createCodReportCommentBodySchema, getCodReportsQuerySchema, lecturerApprovalDecisionBodySchema, lecturerApprovalIdParamsSchema } from "./cod.validation.js";
import { feature5CodRoutes } from "../feature5/cod.routes.js";
import { getCodAttendanceDiscrepancies, getCodAttendanceDiscrepancyById, getCodAttendanceDiscrepancyDecisions, postCodAttendanceDiscrepancyDecision, postCodLegacyAttendanceRevalidation } from "./attendance-discrepancy.controller.js";
import { attendanceDiscrepancyIdParamsSchema, attendanceDiscrepancyListQuerySchema, codAttendanceDiscrepancyDecisionBodySchema, codLegacyAttendanceRevalidationBodySchema } from "./attendance-discrepancy.validation.js";
import { getCodAssessmentAttendance, getCodAttendanceAttempts, getCodAttendanceDiscrepancyAudit, getCodAttendanceHistory, getCodAttendanceRecords, getCodAttendanceStatistics, getCodAttendanceSummary } from "./attendance-history.controller.js";
import { codAttendanceAggregateQuerySchema, codAttendanceAttemptsQuerySchema, codAttendanceRecordIdParamsSchema, codAttendanceRecordsQuerySchema, codAssessmentAttendanceQuerySchema } from "./cod.validation.js";

export const codRoutes = Router();

codRoutes.use(authenticate);
codRoutes.use(authorize("cod"));
codRoutes.get("/pending-lecturer-approvals", getPendingLecturerApprovals);
codRoutes.patch("/lecturer-approvals/:id", validate(lecturerApprovalIdParamsSchema, "params"), validate(lecturerApprovalDecisionBodySchema), decideLecturerApproval);
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
codRoutes.get("/reports/:id/eligible-lecturers", validate(codReportIdParamsSchema, "params"), getCodEligibleLecturers);
codRoutes.post(
  "/reports/:id/assign",
  validate(codReportIdParamsSchema, "params"),
  validate(assignCodReportBodySchema, "body"),
  assignCodReport,
);
codRoutes.post(
  "/reports/:id/decision",
  validate(codReportIdParamsSchema, "params"),
  validate(codReportDecisionBodySchema, "body"),
  decideCodReport,
);
