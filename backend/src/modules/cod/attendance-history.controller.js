import { sendSuccess } from "../../shared/utils/api-response.js";
import {
  getCodAttendanceRecordHistory,
  getCodAttendanceStatistics as loadCodAttendanceStatistics,
  getCodAttendanceSummary as loadCodAttendanceSummary,
  listCodAssessmentAttendance,
  listCodAttendanceAttempts,
  listCodAttendanceDiscrepancyAudit,
  listCodAttendanceRecords,
} from "./attendance-history.service.js";

function queryArgs(req) {
  return { userId: req.user.id, ...req.query };
}

export async function getCodAttendanceRecords(req, res, next) {
  try { return sendSuccess(res, "Departmental attendance records retrieved successfully", await listCodAttendanceRecords(queryArgs(req))); }
  catch (error) { return next(error); }
}
export async function getCodAssessmentAttendance(req, res, next) {
  try { return sendSuccess(res, "Departmental assessment attendance retrieved successfully", await listCodAssessmentAttendance(queryArgs(req))); }
  catch (error) { return next(error); }
}
export async function getCodAttendanceAttempts(req, res, next) {
  try { return sendSuccess(res, "Departmental attendance attempts retrieved successfully", await listCodAttendanceAttempts(queryArgs(req))); }
  catch (error) { return next(error); }
}
export async function getCodAttendanceHistory(req, res, next) {
  try { return sendSuccess(res, "Attendance record history retrieved successfully", await getCodAttendanceRecordHistory({ userId: req.user.id, recordId: req.params.id })); }
  catch (error) { return next(error); }
}
export async function getCodAttendanceDiscrepancyAudit(req, res, next) {
  try { return sendSuccess(res, "Attendance discrepancy audit events retrieved successfully", await listCodAttendanceDiscrepancyAudit({ userId: req.user.id, discrepancyId: req.params.id })); }
  catch (error) { return next(error); }
}
export async function getCodAttendanceSummary(req, res, next) {
  try { return sendSuccess(res, "Departmental attendance summary retrieved successfully", await loadCodAttendanceSummary(queryArgs(req))); }
  catch (error) { return next(error); }
}
export async function getCodAttendanceStatistics(req, res, next) {
  try { return sendSuccess(res, "Departmental attendance statistics retrieved successfully", await loadCodAttendanceStatistics(queryArgs(req))); }
  catch (error) { return next(error); }
}
