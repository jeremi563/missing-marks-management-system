import { sendSuccess } from "../../shared/utils/api-response.js";
import { decideDepartmentLecturerAccount, listPendingDepartmentLecturers } from "../admin/admin.service.js";
import { addCodReportComment, assignReportToLecturer, decideEscalatedReport, getCodReportDetails, listCodReportComments, listEligibleLecturers, listDepartmentReports } from "./cod.service.js";

export async function getPendingLecturerApprovals(req, res, next) {
  try {
    const accounts = await listPendingDepartmentLecturers({ db: req.app.locals.prisma, userId: req.user.id });
    return sendSuccess(res, "Pending department lecturer approvals retrieved successfully", accounts);
  } catch (error) {
    return next(error);
  }
}

export async function decideLecturerApproval(req, res, next) {
  try {
    const result = await decideDepartmentLecturerAccount({
      db: req.app.locals.prisma,
      actorUserId: req.user.id,
      userId: req.params.id,
      status: req.body.status,
    });
    return sendSuccess(res, "Lecturer approval decision saved", result);
  } catch (error) {
    return next(error);
  }
}

export async function getCodReport(req, res, next) {
  try {
    const result = await getCodReportDetails({ userId: req.user.id, reportId: req.params.id });
    return sendSuccess(res, "Departmental report retrieved successfully", result);
  } catch (error) {
    return next(error);
  }
}

export async function getCodComments(req, res, next) {
  try {
    const result = await listCodReportComments({ userId: req.user.id, reportId: req.params.id });
    return sendSuccess(res, "Report comments retrieved successfully", result);
  } catch (error) {
    return next(error);
  }
}

export async function postCodComment(req, res, next) {
  try {
    const result = await addCodReportComment({
      actorUserId: req.user.id,
      reportId: req.params.id,
      body: req.body.body,
    });
    return sendSuccess(res, "Report comment added successfully", result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function getCodReports(req, res, next) {
  try {
    const result = await listDepartmentReports({
      userId: req.user.id,
      departmentId: req.query.departmentId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort,
    });

    return sendSuccess(res, "Departmental reports retrieved successfully", result);
  } catch (error) {
    return next(error);
  }
}

export async function getCodEligibleLecturers(req, res, next) {
  try {
    const result = await listEligibleLecturers({ userId: req.user.id, reportId: req.params.id });
    return sendSuccess(res, "Eligible lecturers retrieved successfully", result);
  } catch (error) {
    return next(error);
  }
}

export async function assignCodReport(req, res, next) {
  try {
    const result = await assignReportToLecturer({
      actorUserId: req.user.id,
      reportId: req.params.id,
      lecturerProfileId: req.body.lecturerProfileId,
      reason: req.body.reason,
    });
    return sendSuccess(res, "Report assigned successfully", result);
  } catch (error) {
    return next(error);
  }
}

export async function decideCodReport(req, res, next) {
  try {
    const result = await decideEscalatedReport({
      actorUserId: req.user.id,
      reportId: req.params.id,
      decision: req.body.decision,
      reason: req.body.reason,
    });
    return sendSuccess(res, "Final report decision recorded successfully", result);
  } catch (error) {
    return next(error);
  }
}
