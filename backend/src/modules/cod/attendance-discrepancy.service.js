import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { lockDepartmentForReview } from "../../shared/services/department-review-lock.service.js";
import { AppError } from "../../shared/utils/app-error.js";
import { getAuthorizedDepartmentIds } from "./cod.service.js";

export const COD_DISCREPANCY_DECISIONS = Object.freeze({
  CONFIRM_DISCREPANCY: "CONFIRMED",
  REJECT_DISCREPANCY: "REJECTED",
  REQUEST_CLARIFICATION: "CLARIFICATION_REQUESTED",
  RECOMMEND_CORRECTION: "CORRECTION_RECOMMENDED",
  AUTHORIZE_ATTENDANCE_CORRECTION: "CORRECTION_AUTHORIZED",
});

const COD_VISIBLE_STATUSES = ["PENDING_COD_REVIEW", "CLARIFICATION_REQUESTED", ...Object.values(COD_DISCREPANCY_DECISIONS).filter((status) => status !== "CLARIFICATION_REQUESTED")];

function sourceCount(item) {
  return [item.attendanceRecordId, item.assessmentAttendanceId, item.attendanceAttemptId].filter(Boolean).length;
}

function getSourceContext(item) {
  if (sourceCount(item) !== 1) throw new AppError(409, "Discrepancy must reference exactly one attendance source");

  if (item.attendanceRecordId) {
    const source = item.attendanceRecord;
    if (!source || source.studentProfileId !== item.studentProfileId) throw new AppError(409, "Attendance source does not match the discrepancy student");
    return { type: "ATTENDANCE_RECORD", source, courseUnit: source.session?.courseUnit };
  }
  if (item.assessmentAttendanceId) {
    const source = item.assessmentRecord;
    if (!source || source.studentProfileId !== item.studentProfileId) throw new AppError(409, "Attendance source does not match the discrepancy student");
    return { type: "ASSESSMENT_ATTENDANCE", source, courseUnit: source.assessment?.courseUnit };
  }
  const source = item.attendanceAttempt;
  if (!source || source.studentProfileId !== item.studentProfileId) throw new AppError(409, "Attendance source does not match the discrepancy student");
  return { type: "ATTENDANCE_ATTEMPT", source, courseUnit: source.session?.courseUnit };
}

const sourceInclude = {
  attendanceRecord: { select: { id: true, studentProfileId: true, status: true, locationVerified: true, recordedAt: true, session: { select: { id: true, courseUnitId: true, assessmentId: true, sessionType: true, startsAt: true, endsAt: true, courseUnit: { select: { id: true, code: true, name: true, departmentId: true, department: { select: { id: true, name: true, designatedCodUserId: true } } } } } } } },
  assessmentRecord: { select: { id: true, studentProfileId: true, assessmentId: true, status: true, recordedAt: true, assessment: { select: { id: true, courseUnitId: true, code: true, name: true, type: true, assessmentDate: true, courseUnit: { select: { id: true, code: true, name: true, departmentId: true, department: { select: { id: true, name: true, designatedCodUserId: true } } } } } } } },
  attendanceAttempt: { select: { id: true, studentProfileId: true, outcome: true, failureReason: true, occurredAt: true, session: { select: { id: true, courseUnitId: true, assessmentId: true, sessionType: true, startsAt: true, endsAt: true, courseUnit: { select: { id: true, code: true, name: true, departmentId: true, department: { select: { id: true, name: true, designatedCodUserId: true } } } } } } } },
  reporter: { select: { id: true, displayName: true, email: true } },
  lecturerReviewer: { select: { id: true, user: { select: { id: true, displayName: true } } } },
  missingMarkReport: { select: { id: true, reference: true, studentProfileId: true, courseUnitId: true, assessmentId: true, academicPeriodId: true, assessment: { select: { id: true, courseUnitId: true } } } },
};

function assertSourceContext(item) {
  const context = getSourceContext(item);
  if (!context.courseUnit?.departmentId) throw new AppError(409, "Attendance source has no valid course unit or department");
  return context;
}

async function assertAuthorizedDepartment(db, userId, item) {
  const context = assertSourceContext(item);
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.includes(context.courseUnit.departmentId)) throw new AppError(404, "Attendance discrepancy not found");
  return context;
}

function validateReportCompatibility(item, context) {
  const report = item.missingMarkReport;
  if (!item.missingMarkReportId) return;
  if (!report || report.studentProfileId !== item.studentProfileId || report.courseUnitId !== context.courseUnit.id) {
    throw new AppError(409, "Linked missing-mark report is not compatible with this discrepancy");
  }
  if (report.assessmentId && report.assessment?.courseUnitId !== report.courseUnitId) {
    throw new AppError(409, "Linked missing-mark report has an incompatible assessment");
  }
  const sourceAssessmentId = context.type === "ASSESSMENT_ATTENDANCE" ? context.source.assessmentId : context.source.session?.assessmentId;
  if (report.assessmentId && sourceAssessmentId && report.assessmentId !== sourceAssessmentId) {
    throw new AppError(409, "Linked missing-mark report refers to a different assessment");
  }
}

function assertCodVisible(item) {
  if (item.status === "PENDING_LECTURER_REVIEW") throw new AppError(409, "This discrepancy must be forwarded by a lecturer before COD review");
  if (!COD_VISIBLE_STATUSES.includes(item.status)) throw new AppError(409, "This discrepancy is not in a COD-visible workflow state");
  if (item.submitterType === "STUDENT" && (!item.lecturerReviewedByProfileId || !item.lecturerReviewedAt)) {
    throw new AppError(409, "Student-submitted discrepancies require lecturer review before COD review");
  }
  if (!item.submitterType || !["STUDENT", "LECTURER"].includes(item.submitterType)) {
    throw new AppError(409, "Discrepancy reporter provenance is missing or invalid");
  }
}

async function validateReporterAndReview(db, item, context) {
  const expectedRole = item.submitterType === "STUDENT" ? "student" : "lecturer";
  if (!item.submittedByUserId || !["STUDENT", "LECTURER"].includes(item.submitterType)) {
    throw new AppError(409, "Discrepancy reporter provenance is missing or invalid");
  }
  const reporter = await db.user.findFirst({
    where: { id: item.submittedByUserId, isActive: true, roles: { some: { role: { name: expectedRole } } } },
    select: { id: true },
  });
  if (!reporter) throw new AppError(409, "Discrepancy reporter is not an active user with the required role");
  if (item.submitterType === "STUDENT") {
    const student = await db.studentProfile.findUnique({ where: { id: item.studentProfileId }, select: { userId: true } });
    if (!student || student.userId !== reporter.id) throw new AppError(409, "Student reporter does not own this discrepancy");
    if (item.status !== "PENDING_LECTURER_REVIEW") {
      if (!item.lecturerReviewedByProfileId || !item.lecturerReviewedAt || item.lecturerReviewedByProfileId !== item.assignedLecturerProfileId) {
        throw new AppError(409, "Student-submitted discrepancies require assigned lecturer review before COD review");
      }
      const reviewer = await db.lecturerProfile.findUnique({
        where: { id: item.lecturerReviewedByProfileId },
        select: { id: true, user: { select: { isActive: true, roles: { select: { role: { select: { name: true } } } } } } },
      });
      const reviewerIsLecturer = reviewer?.user?.isActive && reviewer.user.roles.some(({ role }) => role.name === "lecturer");
      const assignedToUnit = await db.courseUnitLecturer.findUnique({
        where: { courseUnitId_lecturerProfileId: { courseUnitId: context.courseUnit.id, lecturerProfileId: item.lecturerReviewedByProfileId } },
        select: { id: true },
      });
      if (!reviewerIsLecturer || !assignedToUnit) throw new AppError(409, "Recorded lecturer review is not valid for this course unit");
    }
  } else {
    const lecturer = await db.lecturerProfile.findUnique({ where: { userId: reporter.id }, select: { id: true } });
    if (!lecturer) throw new AppError(409, "Lecturer reporter has no lecturer profile");
    const assignedToUnit = await db.courseUnitLecturer.findUnique({
      where: { courseUnitId_lecturerProfileId: { courseUnitId: context.courseUnit.id, lecturerProfileId: lecturer.id } },
      select: { id: true },
    });
    if (!assignedToUnit) throw new AppError(409, "Lecturer reporter is not assigned to this course unit");
  }
}

async function assertCodEligible(db, item) {
  assertCodVisible(item);
  if (item.status !== "PENDING_COD_REVIEW" && item.status !== "CLARIFICATION_REQUESTED") {
    throw new AppError(409, "This discrepancy is not eligible for a COD decision");
  }
  if (item.status === "CLARIFICATION_REQUESTED") {
    const latestRequest = await db.attendanceDiscrepancyDecision.findFirst({
      where: { discrepancyId: item.id, decision: "REQUEST_CLARIFICATION" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const clarification = latestRequest && await db.attendanceDiscrepancyComment.findFirst({
      where: { discrepancyId: item.id, clarificationDecisionId: latestRequest.id, authorUserId: item.submittedByUserId },
      select: { id: true },
    });
    if (!clarification) throw new AppError(409, "A clarification response is required before COD review can continue");
  }
}

export async function listCodAttendanceDiscrepancies({ userId, departmentId, status, page = 1, limit = 20, db = prisma }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  const scopedDepartmentIds = departmentId ? departmentIds.filter((id) => id === departmentId) : departmentIds;
  if (departmentId && !departmentIds.includes(departmentId)) throw new AppError(404, "Department not found");
  const sourceDepartment = { in: scopedDepartmentIds };
  const where = {
    status: status ?? { in: COD_VISIBLE_STATUSES },
    OR: [
      { attendanceRecord: { is: { session: { is: { courseUnit: { is: { departmentId: sourceDepartment } } } } } } },
      { assessmentRecord: { is: { assessment: { is: { courseUnit: { is: { departmentId: sourceDepartment } } } } } } },
      { attendanceAttempt: { is: { session: { is: { courseUnit: { is: { departmentId: sourceDepartment } } } } } } },
    ],
  };
  const [items, total] = await db.$transaction(async (tx) => Promise.all([
    tx.attendanceDiscrepancy.findMany({ where, include: sourceInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    tx.attendanceDiscrepancy.count({ where }),
  ]));
  for (const item of items) {
    assertCodVisible(item);
    const context = assertSourceContext(item);
    await validateReporterAndReview(db, item, context);
    validateReportCompatibility(item, context);
  }
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getCodAttendanceDiscrepancy({ userId, discrepancyId, db = prisma }) {
  const item = await db.attendanceDiscrepancy.findUnique({ where: { id: discrepancyId }, include: { ...sourceInclude, comments: { include: { author: { select: { id: true, displayName: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!item) throw new AppError(404, "Attendance discrepancy not found");
  const context = await assertAuthorizedDepartment(db, userId, item);
  assertCodVisible(item);
  await validateReporterAndReview(db, item, context);
  validateReportCompatibility(item, context);
  return { ...item, sourceType: context.type, source: context.source, courseUnit: context.courseUnit };
}

export async function listCodAttendanceDiscrepancyDecisions({ userId, discrepancyId, db = prisma }) {
  const item = await db.attendanceDiscrepancy.findUnique({ where: { id: discrepancyId }, include: sourceInclude });
  if (!item) throw new AppError(404, "Attendance discrepancy not found");
  const context = await assertAuthorizedDepartment(db, userId, item);
  assertCodVisible(item);
  await validateReporterAndReview(db, item, context);
  validateReportCompatibility(item, context);
  return db.attendanceDiscrepancyDecision.findMany({
    where: { discrepancyId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { actor: { select: { id: true, displayName: true } } },
  });
}

export async function recordCodAttendanceDiscrepancyDecision({ userId, discrepancyId, decision, explanation, db = prisma }) {
  const newStatus = COD_DISCREPANCY_DECISIONS[decision];
  if (!newStatus) throw new AppError(400, "Unsupported COD discrepancy decision");
  return db.$transaction(async (tx) => {
    const item = await tx.attendanceDiscrepancy.findUnique({ where: { id: discrepancyId }, include: sourceInclude });
    if (!item) throw new AppError(404, "Attendance discrepancy not found");
    const sourceContext = assertSourceContext(item);
    await lockDepartmentForReview(tx, sourceContext.courseUnit.departmentId);
    const context = await assertAuthorizedDepartment(tx, userId, item);
    validateReportCompatibility(item, context);
    await validateReporterAndReview(tx, item, context);
    await assertCodEligible(tx, item);
    const updated = await tx.attendanceDiscrepancy.updateMany({
      where: { id: item.id, status: item.status },
      data: { status: newStatus, resolution: explanation.trim() },
    });
    if (updated.count !== 1) throw new AppError(409, "Discrepancy state changed; reload before deciding");
    const history = await tx.attendanceDiscrepancyDecision.create({
      data: { discrepancyId: item.id, actorUserId: userId, decision, explanation: explanation.trim(), previousStatus: item.status, newStatus },
    });
    await recordAuditEvent({
      prismaClient: tx,
      actorId: userId,
      action: `COD_ATTENDANCE_DISCREPANCY_${decision}`,
      entityType: "AttendanceDiscrepancy",
      entityId: item.id,
      metadata: { decisionId: history.id, previousStatus: item.status, newStatus },
    });
    return { discrepancyId: item.id, status: newStatus, decision: history };
  });
}
