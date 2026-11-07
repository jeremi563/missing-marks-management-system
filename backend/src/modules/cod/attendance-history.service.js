import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";
import { getAuthorizedCodAttendanceDiscrepancy } from "./attendance-discrepancy.service.js";
import { getAuthorizedDepartmentIds } from "./cod.service.js";

function dateRange(from, to, field) {
  if (!from && !to) return undefined;
  return { [field]: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } };
}

async function getScope(db, userId, departmentId) {
  const authorized = await getAuthorizedDepartmentIds(db, userId);
  if (departmentId && !authorized.includes(departmentId)) throw new AppError(404, "Department not found");
  return departmentId ? [departmentId] : authorized;
}

function pageResult(items, total, page, limit) {
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

function recordWhere({ departments, courseUnitId, studentProfileId, status, from, to }) {
  return {
    session: { is: { courseUnit: { is: { departmentId: { in: departments }, ...(courseUnitId ? { id: courseUnitId } : {}) } } } },
    ...(studentProfileId ? { studentProfileId } : {}),
    ...(status ? { status } : {}),
    ...(dateRange(from, to, "recordedAt") ?? {}),
  };
}

function assessmentWhere({ departments, courseUnitId, studentProfileId, status, from, to }) {
  return {
    assessment: { is: { courseUnit: { is: { departmentId: { in: departments }, ...(courseUnitId ? { id: courseUnitId } : {}) } } } },
    ...(studentProfileId ? { studentProfileId } : {}),
    ...(status ? { status } : {}),
    ...(dateRange(from, to, "recordedAt") ?? {}),
  };
}

function attemptWhere({ departments, courseUnitId, studentProfileId, outcome, from, to }) {
  return {
    session: { is: { courseUnit: { is: { departmentId: { in: departments }, ...(courseUnitId ? { id: courseUnitId } : {}) } } } },
    ...(studentProfileId ? { studentProfileId } : {}),
    ...(outcome ? { outcome } : {}),
    ...(dateRange(from, to, "occurredAt") ?? {}),
  };
}

async function listPaged({ db, model, where, page, limit, orderBy, select }) {
  if (where.session?.is?.courseUnit?.is?.departmentId?.in?.length === 0 ||
      where.assessment?.is?.courseUnit?.is?.departmentId?.in?.length === 0) {
    return pageResult([], 0, page, limit);
  }
  const [items, total] = await Promise.all([
    db[model].findMany({ where, select, orderBy, skip: (page - 1) * limit, take: limit }),
    db[model].count({ where }),
  ]);
  return pageResult(items, total, page, limit);
}

export async function listCodAttendanceRecords({ userId, departmentId, courseUnitId, studentProfileId, status, from, to, page = 1, limit = 20, db = prisma }) {
  const departments = await getScope(db, userId, departmentId);
  return listPaged({ db, model: "attendanceRecord", where: recordWhere({ departments, courseUnitId, studentProfileId, status, from, to }), page, limit,
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    select: { id: true, studentProfileId: true, status: true, locationVerified: true, recordedAt: true,
      student: { select: { id: true, studentNumber: true } },
      session: { select: { id: true, startsAt: true, courseUnit: { select: { id: true, code: true, name: true, department: { select: { id: true, name: true } } } } } },
    },
  });
}

export async function listCodAssessmentAttendance({ userId, departmentId, courseUnitId, studentProfileId, status, from, to, page = 1, limit = 20, db = prisma }) {
  const departments = await getScope(db, userId, departmentId);
  return listPaged({ db, model: "assessmentAttendance", where: assessmentWhere({ departments, courseUnitId, studentProfileId, status, from, to }), page, limit,
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    select: { id: true, assessmentId: true, studentProfileId: true, status: true, recordedAt: true, createdAt: true,
      student: { select: { id: true, studentNumber: true } },
      assessment: { select: { id: true, code: true, name: true, type: true, assessmentDate: true, courseUnit: { select: { id: true, code: true, name: true, department: { select: { id: true, name: true } } } } } },
    },
  });
}

export async function listCodAttendanceAttempts({ userId, departmentId, courseUnitId, studentProfileId, outcome, from, to, page = 1, limit = 20, db = prisma }) {
  const departments = await getScope(db, userId, departmentId);
  return listPaged({ db, model: "attendanceAttempt", where: attemptWhere({ departments, courseUnitId, studentProfileId, outcome, from, to }), page, limit,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: { id: true, studentProfileId: true, outcome: true, failureReason: true, occurredAt: true,
      student: { select: { id: true, studentNumber: true } },
      session: { select: { id: true, startsAt: true, courseUnit: { select: { id: true, code: true, name: true, department: { select: { id: true, name: true } } } } } },
    },
  });
}

export async function getCodAttendanceRecordHistory({ userId, recordId, db = prisma }) {
  const departments = await getScope(db, userId);
  const record = await db.attendanceRecord.findFirst({
    where: { id: recordId, session: { is: { courseUnit: { is: { departmentId: { in: departments } } } } } },
    select: { id: true, session: { select: { courseUnit: { select: { id: true, departmentId: true } } } },
      history: { select: { id: true, courseUnitCode: true, courseUnitName: true, sessionStartedAt: true, status: true, locationVerified: true, signedAt: true, createdAt: true } },
      corrections: { select: { id: true, originalStatus: true, correctedStatus: true, reason: true, createdAt: true, lecturer: { select: { id: true, staffNumber: true } }, administrator: { select: { id: true, displayName: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!record) throw new AppError(404, "Attendance record not found");
  return { attendanceRecordId: record.id, history: record.history, corrections: record.corrections };
}

export async function listCodAttendanceDiscrepancyAudit({ userId, discrepancyId, db = prisma }) {
  const { item } = await getAuthorizedCodAttendanceDiscrepancy({ userId, discrepancyId, db });
  const events = await db.auditLog.findMany({
    where: {
      entityType: "AttendanceDiscrepancy",
      entityId: item.id,
      OR: [
        { action: { startsWith: "COD_ATTENDANCE_DISCREPANCY_" } },
        { action: "ADMIN_ATTENDANCE_CORRECTION_APPLIED" },
      ],
    },
    select: { id: true, action: true, actorId: true, createdAt: true, metadata: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return events.filter(({ action }) => action.startsWith("COD_ATTENDANCE_DISCREPANCY_") || action === "ADMIN_ATTENDANCE_CORRECTION_APPLIED").map(({ id, action, actorId, createdAt, metadata }) => ({
    id, action, actorId, createdAt,
    metadata: metadata && typeof metadata === "object" ? {
      ...(metadata.decisionId != null ? { decisionId: metadata.decisionId } : {}),
      ...(metadata.previousStatus != null ? { previousStatus: metadata.previousStatus } : {}),
      ...(metadata.newStatus != null ? { newStatus: metadata.newStatus } : {}),
      ...(action === "ADMIN_ATTENDANCE_CORRECTION_APPLIED" && metadata.attendanceCorrectionId != null ? { attendanceCorrectionId: metadata.attendanceCorrectionId } : {}),
      ...(action === "ADMIN_ATTENDANCE_CORRECTION_APPLIED" && metadata.attendanceRecordId != null ? { attendanceRecordId: metadata.attendanceRecordId } : {}),
      ...(action === "ADMIN_ATTENDANCE_CORRECTION_APPLIED" && metadata.originalStatus != null ? { originalStatus: metadata.originalStatus } : {}),
      ...(action === "ADMIN_ATTENDANCE_CORRECTION_APPLIED" && metadata.correctedStatus != null ? { correctedStatus: metadata.correctedStatus } : {}),
    } : {},
  }));
}

async function aggregateSources({ userId, departmentId, courseUnitId, from, to, db }) {
  const departments = await getScope(db, userId, departmentId);
  const record = recordWhere({ departments, courseUnitId, from, to });
  const assessment = assessmentWhere({ departments, courseUnitId, from, to });
  const attempt = attemptWhere({ departments, courseUnitId, from, to });
  const correction = { attendanceRecord: { is: recordWhere({ departments, courseUnitId }) }, ...(dateRange(from, to, "createdAt") ?? {}) };
  const unitScope = { departmentId: { in: departments }, ...(courseUnitId ? { id: courseUnitId } : {}) };
  const sessionScope = { is: { courseUnit: { is: unitScope } } };
  const discrepancy = {
    OR: [
      {
        attendanceRecordId: { not: null },
        assessmentAttendanceId: null,
        attendanceAttemptId: null,
        attendanceRecord: { is: { session: sessionScope } },
      },
      {
        attendanceRecordId: null,
        assessmentAttendanceId: { not: null },
        attendanceAttemptId: null,
        assessmentRecord: { is: { assessment: { is: { courseUnit: { is: unitScope } } } } },
      },
      {
        attendanceRecordId: null,
        assessmentAttendanceId: null,
        attendanceAttemptId: { not: null },
        attendanceAttempt: { is: { session: sessionScope } },
      },
    ],
    ...(dateRange(from, to, "createdAt") ?? {}),
  };
  if (!departments.length) return { departments, record, assessment, attempt, correction, discrepancy, empty: true };
  return { departments, record, assessment, attempt, correction, discrepancy, empty: false };
}

async function grouped(db, model, where, by) {
  const rows = await db[model].groupBy({ by: [by], where, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row[by], row._count._all]));
}

export async function getCodAttendanceSummary({ userId, departmentId, courseUnitId, from, to, db = prisma }) {
  const scope = await aggregateSources({ userId, departmentId, courseUnitId, from, to, db });
  if (scope.empty) return { scope: { departmentIds: scope.departments, courseUnitId: courseUnitId ?? null, from: from ?? null, to: to ?? null }, sessionAttendance: { total: 0 }, assessmentAttendance: { total: 0 }, attempts: { total: 0 }, corrections: { total: 0 }, discrepancies: { total: 0 } };
  const [sessionAttendance, assessmentAttendance, attempts, corrections, discrepancies] = await Promise.all([
    db.attendanceRecord.count({ where: scope.record }), db.assessmentAttendance.count({ where: scope.assessment }),
    db.attendanceAttempt.count({ where: scope.attempt }), db.attendanceCorrection.count({ where: scope.correction }), db.attendanceDiscrepancy.count({ where: scope.discrepancy }),
  ]);
  return { scope: { departmentIds: scope.departments, courseUnitId: courseUnitId ?? null, from: from ?? null, to: to ?? null }, sessionAttendance: { total: sessionAttendance }, assessmentAttendance: { total: assessmentAttendance }, attempts: { total: attempts }, corrections: { total: corrections }, discrepancies: { total: discrepancies } };
}

export async function getCodAttendanceStatistics({ userId, departmentId, courseUnitId, from, to, db = prisma }) {
  const scope = await aggregateSources({ userId, departmentId, courseUnitId, from, to, db });
  const emptyStats = { statusCounts: {}, denominator: 0, rates: null };
  if (scope.empty) return { scope: { departmentIds: scope.departments, courseUnitId: courseUnitId ?? null, from: from ?? null, to: to ?? null }, sessionAttendance: emptyStats, assessmentAttendance: emptyStats, attempts: { outcomeCounts: {} }, corrections: { total: 0 }, discrepancies: { statusCounts: {} } };
  const [recordStatuses, assessmentStatuses, attemptOutcomes, correctionTotal, discrepancyStatuses, sessionTotal, assessmentTotal] = await Promise.all([
    grouped(db, "attendanceRecord", scope.record, "status"), grouped(db, "assessmentAttendance", scope.assessment, "status"), grouped(db, "attendanceAttempt", scope.attempt, "outcome"),
    db.attendanceCorrection.count({ where: scope.correction }), grouped(db, "attendanceDiscrepancy", scope.discrepancy, "status"),
    db.attendanceRecord.count({ where: scope.record }), db.assessmentAttendance.count({ where: scope.assessment }),
  ]);
  const withRates = (counts, denominator) => ({ statusCounts: counts, denominator, rates: denominator ? Object.fromEntries(Object.entries(counts).map(([status, count]) => [status, count / denominator])) : null });
  return { scope: { departmentIds: scope.departments, courseUnitId: courseUnitId ?? null, from: from ?? null, to: to ?? null }, sessionAttendance: withRates(recordStatuses, sessionTotal), assessmentAttendance: withRates(assessmentStatuses, assessmentTotal), attempts: { outcomeCounts: attemptOutcomes }, corrections: { total: correctionTotal }, discrepancies: { statusCounts: discrepancyStatuses } };
}
