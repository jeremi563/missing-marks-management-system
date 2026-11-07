import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const service = await import("../../src/modules/cod/attendance-history.service.js");
const validation = await import("../../src/modules/cod/cod.validation.js");

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  department: "22222222-2222-4222-8222-222222222222",
  otherDepartment: "33333333-3333-4333-8333-333333333333",
  courseUnit: "44444444-4444-4444-8444-444444444444",
  student: "55555555-5555-4555-8555-555555555555",
  record: "66666666-6666-4666-8666-666666666666",
  discrepancy: "77777777-7777-4777-8777-777777777777",
};

function fakeDb({ active = true, codRole = true, memberships = [ids.department], designated = [ids.department], record = null, countOverrides = {}, discrepancy = { id: ids.discrepancy, studentProfileId: ids.student, attendanceRecordId: ids.record, assessmentAttendanceId: null, attendanceAttemptId: null, assignedLecturerProfileId: "88888888-8888-4888-8888-888888888888", submittedByUserId: ids.user, submitterType: "LECTURER", status: "CONFIRMED", attendanceRecord: { id: ids.record, studentProfileId: ids.student, status: "PRESENT", locationVerified: true, recordedAt: new Date("2026-01-02T10:00:00Z"), session: { id: "session-1", courseUnitId: ids.courseUnit, sessionType: "CLASS", startsAt: new Date("2026-01-02T09:00:00Z"), endsAt: null, courseUnit: { id: ids.courseUnit, code: "CS101", name: "Systems", departmentId: ids.department, department: { id: ids.department, name: "Computing", designatedCodUserId: ids.user } } } }, assessmentRecord: null, attendanceAttempt: null, comments: [], missingMarkReport: null }, events = [] } = {}) {
  const calls = {};
  const capture = (model, method, result) => async (args) => { calls[`${model}.${method}`] = args; return typeof result === "function" ? result(args) : result; };
  const counts = { attendanceRecord: 3, assessmentAttendance: 2, attendanceAttempt: 4, attendanceCorrection: 1, attendanceDiscrepancy: 2, ...countOverrides };
  const groups = {
    attendanceRecord: [{ status: "PRESENT", _count: { _all: 2 } }, { status: "LATE", _count: { _all: 1 } }],
    assessmentAttendance: [{ status: "PRESENT", _count: { _all: 2 } }],
    attendanceAttempt: [{ outcome: "REJECTED", _count: { _all: 4 } }],
    attendanceDiscrepancy: [{ status: "CONFIRMED", _count: { _all: 2 } }],
  };
  return {
    calls,
    discrepancy,
    departmentMembership: { findMany: capture("departmentMembership", "findMany", memberships.map((departmentId) => ({ departmentId }))) },
    user: { findFirst: capture("user", "findFirst", active && codRole ? { id: ids.user } : null) },
    lecturerProfile: { findUnique: capture("lecturerProfile", "findUnique", { id: "88888888-8888-4888-8888-888888888888" }) },
    courseUnitLecturer: { findUnique: capture("courseUnitLecturer", "findUnique", { id: "assignment-1" }) },
    department: { findMany: capture("department", "findMany", designated.map((id) => ({ id }))) },
    attendanceRecord: {
      findMany: capture("attendanceRecord", "findMany", []), count: capture("attendanceRecord", "count", counts.attendanceRecord),
      findFirst: capture("attendanceRecord", "findFirst", record), groupBy: capture("attendanceRecord", "groupBy", groups.attendanceRecord),
    },
    assessmentAttendance: { findMany: capture("assessmentAttendance", "findMany", []), count: capture("assessmentAttendance", "count", counts.assessmentAttendance), groupBy: capture("assessmentAttendance", "groupBy", groups.assessmentAttendance) },
    attendanceAttempt: { findMany: capture("attendanceAttempt", "findMany", []), count: capture("attendanceAttempt", "count", counts.attendanceAttempt), groupBy: capture("attendanceAttempt", "groupBy", groups.attendanceAttempt) },
    attendanceCorrection: { count: capture("attendanceCorrection", "count", counts.attendanceCorrection) },
    attendanceDiscrepancy: { findFirst: capture("attendanceDiscrepancy", "findFirst", discrepancy), findUnique: capture("attendanceDiscrepancy", "findUnique", discrepancy), count: capture("attendanceDiscrepancy", "count", counts.attendanceDiscrepancy), groupBy: capture("attendanceDiscrepancy", "groupBy", groups.attendanceDiscrepancy) },
    auditLog: { findMany: capture("auditLog", "findMany", events) },
  };
}

test("active designated COD gets paginated department-scoped records and source queries", async () => {
  const db = fakeDb({ countOverrides: { attendanceRecord: 0, assessmentAttendance: 0, attendanceAttempt: 0 } });
  for (const [fn, model, field] of [
    [service.listCodAttendanceRecords, "attendanceRecord", "recordedAt"],
    [service.listCodAssessmentAttendance, "assessmentAttendance", "recordedAt"],
    [service.listCodAttendanceAttempts, "attendanceAttempt", "occurredAt"],
  ]) {
    const result = await fn({ userId: ids.user, courseUnitId: ids.courseUnit, studentProfileId: ids.student, from: "2026-01-01T00:00:00Z", to: "2026-01-31T23:59:59Z", status: "PRESENT", outcome: "REJECTED", db });
    assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 0, totalPages: 0 });
    const where = db.calls[`${model}.findMany`].where;
    assert.equal(where[field].gte.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(where.studentProfileId, ids.student);
    assert.equal(db.calls[`${model}.findMany`].skip, 0);
    assert.equal(db.calls[`${model}.findMany`].take, 20);
    assert.deepEqual(db.calls[`${model}.findMany`].orderBy.at(-1), { id: "desc" });
  }
  assert.deepEqual(db.calls["attendanceRecord.findMany"].where.session.is.courseUnit.is.departmentId.in, [ids.department]);
  assert.deepEqual(db.calls["assessmentAttendance.findMany"].where.assessment.is.courseUnit.is.departmentId.in, [ids.department]);
  assert.deepEqual(db.calls["attendanceAttempt.findMany"].where.session.is.courseUnit.is.departmentId.in, [ids.department]);
  assert.equal(db.calls["assessmentAttendance.findMany"].where.status, "PRESENT");
  assert.equal(db.calls["attendanceAttempt.findMany"].where.outcome, "REJECTED");
});

test("custom pagination is applied consistently to rows and counts", async () => {
  const db = fakeDb();
  await service.listCodAttendanceRecords({ userId: ids.user, page: 3, limit: 7, db });
  assert.equal(db.calls["attendanceRecord.findMany"].skip, 14);
  assert.equal(db.calls["attendanceRecord.findMany"].take, 7);
  assert.deepEqual(db.calls["attendanceRecord.count"].where, db.calls["attendanceRecord.findMany"].where);
});

test("inactive, non-COD, and unassigned users receive no records", async () => {
  for (const db of [fakeDb({ active: false }), fakeDb({ codRole: false }), fakeDb({ designated: [] })]) {
    const result = await service.listCodAttendanceRecords({ userId: ids.user, db });
    assert.equal(result.pagination.total, 0);
    assert.deepEqual(db.calls["attendanceRecord.findMany"], undefined);
  }
});

test("unauthorized department filter is concealed as not found", async () => {
  await assert.rejects(service.listCodAttendanceRecords({ userId: ids.user, departmentId: ids.otherDepartment, db: fakeDb() }), { statusCode: 404 });
});

test("invalid dates and reversed date ranges are rejected by COD validation", () => {
  assert.equal(validation.codAttendanceRecordsQuerySchema.safeParse({ from: "yesterday" }).success, false);
  assert.equal(validation.codAttendanceRecordsQuerySchema.safeParse({ from: "2026-02-02T00:00:00Z", to: "2026-02-01T00:00:00Z" }).success, false);
  assert.equal(validation.codAttendanceRecordsQuerySchema.safeParse({ limit: "101" }).success, false);
  const defaults = validation.codAttendanceRecordsQuerySchema.parse({});
  assert.equal(defaults.page, 1);
  assert.equal(defaults.limit, 20);
});

test("record history is department scoped and returns only linked snapshot and chronological corrections", async () => {
  const record = { id: ids.record, history: { id: "history" }, corrections: [{ id: "correction-1" }] };
  const db = fakeDb({ record });
  const result = await service.getCodAttendanceRecordHistory({ userId: ids.user, recordId: ids.record, db });
  assert.equal(result.history.id, "history");
  assert.equal(result.corrections[0].id, "correction-1");
  assert.deepEqual(db.calls["attendanceRecord.findFirst"].where.session.is.courseUnit.is.departmentId.in, [ids.department]);
  assert.deepEqual(db.calls["attendanceRecord.findFirst"].select.corrections.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
});

test("record history does not expose a record outside authorized departments", async () => {
  await assert.rejects(service.getCodAttendanceRecordHistory({ userId: ids.user, recordId: ids.record, db: fakeDb({ record: null }) }), { statusCode: 404 });
});

test("an absent linked snapshot stays null and is not inferred from unlinked history rows", async () => {
  const result = await service.getCodAttendanceRecordHistory({ userId: ids.user, recordId: ids.record, db: fakeDb({ record: { id: ids.record, history: null, corrections: [] } }) });
  assert.equal(result.history, null);
  assert.deepEqual(result.corrections, []);
});

test("discrepancy audit first scopes the discrepancy through its source and allowlists actions and metadata", async () => {
  const db = fakeDb({ events: [
    { id: "audit-1", action: "COD_ATTENDANCE_DISCREPANCY_CONFIRMED", actorId: ids.user, createdAt: new Date(), metadata: { decisionId: "d1", previousStatus: "PENDING", newStatus: "CONFIRMED", privateNote: "omit" } },
  ] });
  const rows = await service.listCodAttendanceDiscrepancyAudit({ userId: ids.user, discrepancyId: ids.discrepancy, db });
  assert.equal(db.calls["attendanceDiscrepancy.findUnique"].where.id, ids.discrepancy);
  assert.equal(db.calls["auditLog.findMany"].where.entityType, "AttendanceDiscrepancy");
  assert.deepEqual(db.calls["auditLog.findMany"].where.OR, [
    { action: { startsWith: "COD_ATTENDANCE_DISCREPANCY_" } },
    { action: "ADMIN_ATTENDANCE_CORRECTION_APPLIED" },
  ]);
  assert.deepEqual(rows[0].metadata, { decisionId: "d1", previousStatus: "PENDING", newStatus: "CONFIRMED" });
});

test("authorized discrepancy audit includes the Admin correction event and excludes unrelated Admin events", async () => {
  const db = fakeDb({ events: [
    {
      id: "correction-audit",
      action: "ADMIN_ATTENDANCE_CORRECTION_APPLIED",
      actorId: "admin-1",
      createdAt: new Date(),
      metadata: { attendanceCorrectionId: "correction-1", decisionId: "decision-1", attendanceRecordId: ids.record, originalStatus: "PRESENT", correctedStatus: "ABSENT", privateNote: "omit" },
    },
    { id: "unrelated-admin-audit", action: "ADMIN_USER_UPDATED", actorId: "admin-1", createdAt: new Date(), metadata: { email: "private@example.test" } },
  ] });
  const rows = await service.listCodAttendanceDiscrepancyAudit({ userId: ids.user, discrepancyId: ids.discrepancy, db });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, "ADMIN_ATTENDANCE_CORRECTION_APPLIED");
  assert.deepEqual(rows[0].metadata, {
    decisionId: "decision-1",
    attendanceCorrectionId: "correction-1",
    attendanceRecordId: ids.record,
    originalStatus: "PRESENT",
    correctedStatus: "ABSENT",
  });
  assert.deepEqual(db.calls["auditLog.findMany"].where.OR[1], { action: "ADMIN_ATTENDANCE_CORRECTION_APPLIED" });
});

test("discrepancy audit hides an inaccessible discrepancy without querying its audit log", async () => {
  const db = fakeDb({ designated: [] });
  await assert.rejects(service.listCodAttendanceDiscrepancyAudit({ userId: ids.user, discrepancyId: ids.discrepancy, db }), { statusCode: 404 });
  assert.equal(db.calls["auditLog.findMany"], undefined);
});

test("discrepancy audit rejects non-visible rows before reading audit logs", async () => {
  const valid = fakeDb().discrepancy;
  const db = fakeDb({ discrepancy: { ...valid, status: "PENDING_LECTURER_REVIEW" } });
  await assert.rejects(service.listCodAttendanceDiscrepancyAudit({ userId: ids.user, discrepancyId: ids.discrepancy, db }), { statusCode: 409 });
  assert.equal(db.calls["auditLog.findMany"], undefined);
});

test("discrepancy audit rejects invalid provenance, source ownership, lecturer review and report linkage", async () => {
  const base = fakeDb().discrepancy;
  const invalidRows = [
    { ...base, submitterType: null },
    { ...base, attendanceRecord: { ...base.attendanceRecord, studentProfileId: "other-student" } },
    { ...base, submitterType: "STUDENT", status: "PENDING_COD_REVIEW", lecturerReviewedByProfileId: null, lecturerReviewedAt: null },
    { ...base, missingMarkReportId: "report-1", missingMarkReport: null },
  ];
  for (const discrepancy of invalidRows) {
    const db = fakeDb({ discrepancy });
    await assert.rejects(service.listCodAttendanceDiscrepancyAudit({ userId: ids.user, discrepancyId: ids.discrepancy, db }), { statusCode: 409 });
    assert.equal(db.calls["auditLog.findMany"], undefined);
  }
});

test("summary keeps each source separate and uses correction timestamps independently", async () => {
  const db = fakeDb();
  const result = await service.getCodAttendanceSummary({ userId: ids.user, from: "2026-01-01T00:00:00Z", to: "2026-01-31T00:00:00Z", db });
  assert.deepEqual(result.sessionAttendance, { total: 3 });
  assert.deepEqual(result.assessmentAttendance, { total: 2 });
  assert.deepEqual(result.attempts, { total: 4 });
  assert.deepEqual(result.corrections, { total: 1 });
  assert.deepEqual(result.discrepancies, { total: 2 });
  assert.ok(db.calls["attendanceCorrection.count"].where.createdAt);
  assert.equal(db.calls["attendanceCorrection.count"].where.attendanceRecord.is.recordedAt, undefined);
});

function makeDiscrepancyFixture({ recordDepartment = null, assessmentDepartment = null, attemptDepartment = null } = {}) {
  return {
    attendanceRecordId: recordDepartment ? "record-source" : null,
    assessmentAttendanceId: assessmentDepartment ? "assessment-source" : null,
    attendanceAttemptId: attemptDepartment ? "attempt-source" : null,
    sourceDepartments: {
      attendanceRecord: recordDepartment,
      assessmentAttendance: assessmentDepartment,
      attendanceAttempt: attemptDepartment,
    },
    sourceCourseUnits: {
      attendanceRecord: ids.courseUnit,
      assessmentAttendance: ids.courseUnit,
      attendanceAttempt: ids.courseUnit,
    },
    status: "CONFIRMED",
  };
}

function matchesSourceBranch(row, branch) {
  const sourceFields = ["attendanceRecordId", "assessmentAttendanceId", "attendanceAttemptId"];
  for (const field of sourceFields) {
    if (branch[field] === null && row[field] !== null) return false;
    if (branch[field]?.not === null && row[field] === null) return false;
  }

  const source = branch.attendanceRecord ? "attendanceRecord"
    : branch.assessmentRecord ? "assessmentAttendance"
      : branch.attendanceAttempt ? "attendanceAttempt" : null;
  if (!source || !row[`${source}Id`]) return false;
  const unitScope = source === "assessmentAttendance"
    ? branch.assessmentRecord.is.assessment.is.courseUnit.is
    : branch[source].is.session.is.courseUnit.is;
  return unitScope.departmentId.in.includes(row.sourceDepartments[source]) &&
    (!unitScope.id || unitScope.id === row.sourceCourseUnits[source]);
}

function makeDiscrepancyAggregateDb({ department = ids.department, discrepancies = [] } = {}) {
  const memberships = [{ departmentId: department }];
  const countDiscrepancies = async ({ where }) => discrepancies.filter((row) => where.OR.some((branch) => matchesSourceBranch(row, branch))).length;
  return {
    departmentMembership: { findMany: async () => memberships },
    user: { findFirst: async () => ({ id: ids.user }) },
    department: { findMany: async ({ where }) => memberships.filter(({ departmentId }) => where.id.in.includes(departmentId) && where.designatedCodUserId === ids.user).map(({ departmentId }) => ({ id: departmentId })) },
    attendanceRecord: { count: async () => 0, groupBy: async () => [] },
    assessmentAttendance: { count: async () => 0, groupBy: async () => [] },
    attendanceAttempt: { count: async () => 0, groupBy: async () => [] },
    attendanceCorrection: { count: async () => 0 },
    attendanceDiscrepancy: { count: countDiscrepancies, groupBy: async ({ where }) => {
      const count = await countDiscrepancies({ where });
      return count ? [{ status: "CONFIRMED", _count: { _all: count } }] : [];
    } },
  };
}

test("discrepancy aggregate counts exactly one authorized AttendanceRecord source", async () => {
  const db = makeDiscrepancyAggregateDb({ discrepancies: [makeDiscrepancyFixture({ recordDepartment: ids.department })] });
  const [summary, stats] = await Promise.all([
    service.getCodAttendanceSummary({ userId: ids.user, db }),
    service.getCodAttendanceStatistics({ userId: ids.user, db }),
  ]);
  assert.equal(summary.discrepancies.total, 1);
  assert.deepEqual(stats.discrepancies.statusCounts, { CONFIRMED: 1 });
});

test("discrepancy aggregate counts exactly one authorized AssessmentAttendance source", async () => {
  const db = makeDiscrepancyAggregateDb({ discrepancies: [makeDiscrepancyFixture({ assessmentDepartment: ids.department })] });
  const [summary, stats] = await Promise.all([
    service.getCodAttendanceSummary({ userId: ids.user, db }),
    service.getCodAttendanceStatistics({ userId: ids.user, db }),
  ]);
  assert.equal(summary.discrepancies.total, 1);
  assert.deepEqual(stats.discrepancies.statusCounts, { CONFIRMED: 1 });
});

test("discrepancy aggregate counts exactly one authorized AttendanceAttempt source", async () => {
  const db = makeDiscrepancyAggregateDb({ discrepancies: [makeDiscrepancyFixture({ attemptDepartment: ids.department })] });
  const [summary, stats] = await Promise.all([
    service.getCodAttendanceSummary({ userId: ids.user, db }),
    service.getCodAttendanceStatistics({ userId: ids.user, db }),
  ]);
  assert.equal(summary.discrepancies.total, 1);
  assert.deepEqual(stats.discrepancies.statusCounts, { CONFIRMED: 1 });
});

test("discrepancy aggregate excludes a discrepancy with no attendance source", async () => {
  const db = makeDiscrepancyAggregateDb({ discrepancies: [makeDiscrepancyFixture()] });
  const summary = await service.getCodAttendanceSummary({ userId: ids.user, db });
  assert.equal(summary.discrepancies.total, 0);
});

test("discrepancy aggregate excludes a discrepancy with two attendance sources", async () => {
  const db = makeDiscrepancyAggregateDb({ discrepancies: [makeDiscrepancyFixture({ recordDepartment: ids.department, assessmentDepartment: ids.department })] });
  const summary = await service.getCodAttendanceSummary({ userId: ids.user, db });
  assert.equal(summary.discrepancies.total, 0);
});

test("discrepancy aggregate excludes a discrepancy with all three attendance sources", async () => {
  const db = makeDiscrepancyAggregateDb({ discrepancies: [makeDiscrepancyFixture({ recordDepartment: ids.department, assessmentDepartment: ids.department, attemptDepartment: ids.department })] });
  const summary = await service.getCodAttendanceSummary({ userId: ids.user, db });
  assert.equal(summary.discrepancies.total, 0);
});

test("discrepancy with sources in different departments is excluded from each department aggregate", async () => {
  const malformed = makeDiscrepancyFixture({ recordDepartment: ids.department, assessmentDepartment: ids.otherDepartment });
  const firstDepartmentDb = makeDiscrepancyAggregateDb({ department: ids.department, discrepancies: [malformed] });
  const secondDepartmentDb = makeDiscrepancyAggregateDb({ department: ids.otherDepartment, discrepancies: [malformed] });
  const [first, second] = await Promise.all([
    service.getCodAttendanceSummary({ userId: ids.user, db: firstDepartmentDb }),
    service.getCodAttendanceSummary({ userId: ids.user, db: secondDepartmentDb }),
  ]);
  assert.equal(first.discrepancies.total, 0);
  assert.equal(second.discrepancies.total, 0);
});

test("statistics use recorded-row denominators, keep attempts separate, and return null rates for zero rows", async () => {
  const db = fakeDb();
  const stats = await service.getCodAttendanceStatistics({ userId: ids.user, db });
  assert.equal(stats.sessionAttendance.denominator, 3);
  assert.equal(stats.sessionAttendance.rates.PRESENT, 2 / 3);
  assert.equal(Object.hasOwn(stats.sessionAttendance.statusCounts, "ABSENT"), false);
  assert.equal(stats.assessmentAttendance.denominator, 2);
  assert.deepEqual(stats.attempts, { outcomeCounts: { REJECTED: 4 } });
  assert.deepEqual(stats.discrepancies.statusCounts, { CONFIRMED: 2 });

  const emptyDb = fakeDb({ memberships: [], designated: [] });
  const empty = await service.getCodAttendanceStatistics({ userId: ids.user, db: emptyDb });
  assert.equal(empty.sessionAttendance.denominator, 0);
  assert.equal(empty.sessionAttendance.rates, null);
  assert.deepEqual(empty.sessionAttendance.statusCounts, {});
  assert.equal(empty.assessmentAttendance.rates, null);
});

test("summary for a COD with no authorized departments returns zeros without querying sources", async () => {
  const db = fakeDb({ memberships: [], designated: [] });
  const result = await service.getCodAttendanceSummary({ userId: ids.user, db });
  assert.equal(result.sessionAttendance.total, 0);
  assert.equal(result.assessmentAttendance.total, 0);
  assert.equal(db.calls["attendanceRecord.count"], undefined);
});

test("COD router exposes the new read-only paths and retains existing report and discrepancy routes", async () => {
  const { codRoutes } = await import("../../src/modules/cod/cod.routes.js");
  const routes = codRoutes.stack.filter((layer) => layer.route).map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
  for (const path of ["/attendance-records", "/assessment-attendance", "/attendance-attempts", "/attendance-records/:id/history", "/attendance-discrepancies/:id/audit", "/attendance-summary", "/attendance-statistics"]) {
    assert.ok(routes.some((route) => route.path === path && route.methods.includes("get")), `Missing GET ${path}`);
  }
  assert.ok(routes.some((route) => route.path === "/reports"));
  assert.ok(routes.some((route) => route.path === "/attendance-discrepancies/:id/decisions"));
});
