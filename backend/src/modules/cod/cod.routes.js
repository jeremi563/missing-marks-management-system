import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { assignCodReport, decideCodReport, getCodComments, getCodEligibleLecturers, getCodReport, getCodReports, postCodComment } from "./cod.controller.js";
import { assignCodReportBodySchema, codReportDecisionBodySchema, codReportIdParamsSchema, createCodReportCommentBodySchema, getCodReportsQuerySchema } from "./cod.validation.js";
import { createCodCategory, decideCodAppeal, decideCodCase, getCodAppealById, getCodAppeals, getCodCategories, getCodCaseById, getCodCases, getOverdueAppeals, getOverdueCases, getOverdueReports, updateCodCategory } from "../feature5/feature5.controller.js";
import { appealIdParams, categoryCreateBody, categoryUpdateBody, decisionBody, itemIdParams, pageQuery, specialCaseIdParams, statusPageQuery } from "../feature5/feature5.validation.js";
import { getCodAttendanceDiscrepancies, getCodAttendanceDiscrepancyById, getCodAttendanceDiscrepancyDecisions, postCodAttendanceDiscrepancyDecision } from "./attendance-discrepancy.controller.js";
import { attendanceDiscrepancyIdParamsSchema, attendanceDiscrepancyListQuerySchema, codAttendanceDiscrepancyDecisionBodySchema } from "./attendance-discrepancy.validation.js";
import { getCodAssessmentAttendance, getCodAttendanceAttempts, getCodAttendanceDiscrepancyAudit, getCodAttendanceHistory, getCodAttendanceRecords, getCodAttendanceStatistics, getCodAttendanceSummary } from "./attendance-history.controller.js";
import { codAttendanceAggregateQuerySchema, codAttendanceAttemptsQuerySchema, codAttendanceRecordIdParamsSchema, codAttendanceRecordsQuerySchema, codAssessmentAttendanceQuerySchema } from "./cod.validation.js";

export const codRoutes = Router();

codRoutes.use(authenticate);
codRoutes.use(authorize("cod"));
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
codRoutes.get("/reports/overdue", validate(pageQuery, "query"), getOverdueReports);
codRoutes.get("/appeals/overdue", validate(pageQuery, "query"), getOverdueAppeals);
codRoutes.get("/special-cases/overdue", validate(pageQuery, "query"), getOverdueCases);
codRoutes.get("/appeals", validate(statusPageQuery, "query"), getCodAppeals);
codRoutes.get("/appeals/:appealId", validate(appealIdParams, "params"), getCodAppealById);
codRoutes.post("/appeals/:appealId/decision", validate(appealIdParams, "params"), validate(decisionBody), decideCodAppeal);
codRoutes.get("/special-cases", validate(statusPageQuery, "query"), getCodCases);
codRoutes.get("/special-cases/:caseId", validate(specialCaseIdParams, "params"), getCodCaseById);
codRoutes.post("/special-cases/:caseId/decision", validate(specialCaseIdParams, "params"), validate(decisionBody), decideCodCase);
codRoutes.get("/special-case-categories", getCodCategories);
codRoutes.post("/special-case-categories", validate(categoryCreateBody), createCodCategory);
codRoutes.patch("/special-case-categories/:id", validate(itemIdParams, "params"), validate(categoryUpdateBody), updateCodCategory);
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
