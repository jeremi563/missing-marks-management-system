import { sendSuccess } from "../../shared/utils/api-response.js";
import {
  getCodAttendanceDiscrepancy,
  listCodAttendanceDiscrepancies,
  listCodAttendanceDiscrepancyDecisions,
  recordCodAttendanceDiscrepancyDecision,
} from "./attendance-discrepancy.service.js";

export async function getCodAttendanceDiscrepancies(req, res, next) {
  try {
    const result = await listCodAttendanceDiscrepancies({
      userId: req.user.id,
      departmentId: req.query.departmentId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return sendSuccess(res, "Attendance discrepancies retrieved successfully", result);
  } catch (error) { return next(error); }
}

export async function getCodAttendanceDiscrepancyById(req, res, next) {
  try {
    const result = await getCodAttendanceDiscrepancy({ userId: req.user.id, discrepancyId: req.params.id });
    return sendSuccess(res, "Attendance discrepancy retrieved successfully", result);
  } catch (error) { return next(error); }
}

export async function getCodAttendanceDiscrepancyDecisions(req, res, next) {
  try {
    const result = await listCodAttendanceDiscrepancyDecisions({ userId: req.user.id, discrepancyId: req.params.id });
    return sendSuccess(res, "Attendance discrepancy decision history retrieved successfully", result);
  } catch (error) { return next(error); }
}

export async function postCodAttendanceDiscrepancyDecision(req, res, next) {
  try {
    const result = await recordCodAttendanceDiscrepancyDecision({
      userId: req.user.id,
      discrepancyId: req.params.id,
      decision: req.body.decision,
      explanation: req.body.explanation,
    });
    return sendSuccess(res, "Attendance discrepancy decision recorded successfully", result, 201);
  } catch (error) { return next(error); }
}
