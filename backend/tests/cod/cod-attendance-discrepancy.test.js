import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const {
  getCodAttendanceDiscrepancy,
  listCodAttendanceDiscrepancies,
  listCodAttendanceDiscrepancyDecisions,
  revalidateLegacyAttendanceCorrectionAuthorization,
  recordCodAttendanceDiscrepancyDecision,
} = await import("../../src/modules/cod/attendance-discrepancy.service.js");

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  otherUser: "22222222-2222-4222-8222-222222222222",
  department: "33333333-3333-4333-8333-333333333333",
  otherDepartment: "44444444-4444-4444-8444-444444444444",
  discrepancy: "55555555-5555-4555-8555-555555555555",
  student: "66666666-6666-4666-8666-666666666666",
  report: "77777777-7777-4777-8777-777777777777",
  lecturerProfile: "88888888-8888-4888-8888-888888888888",
};

function makeFixture({ sourceType = "record", status = "PENDING_COD_REVIEW", submitterType = "LECTURER", authorized = true, multipleSources = false, mismatch = false, reportMismatch = false, reportAssessmentId = null, sourceAssessmentId = null, failAudit = false, updateCount = 1, listItems = [], validationFailure = null, initialDecisions = [], initialAuditEvents = [] } = {}) {
  const courseUnit = { id: "99999999-9999-4999-8999-999999999999", code: "CS101", name: "Systems", departmentId: ids.department, department: { id: ids.department, name: "Computing", designatedCodUserId: ids.user } };
  const sourceStudent = mismatch ? ids.otherUser : ids.student;
  const attendanceRecord = sourceType === "record" ? { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", studentProfileId: sourceStudent, status: "PRESENT", recordedAt: new Date("2026-01-02T10:00:00Z"), history: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "PRESENT", signedAt: new Date("2026-01-02T10:00:00Z") }, session: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", assessmentId: sourceAssessmentId, startsAt: new Date("2026-01-02T09:00:00Z"), courseUnit } } : null;
  const assessmentRecord = sourceType === "assessment" ? { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", studentProfileId: sourceStudent, assessmentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", status: "PRESENT", assessment: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", courseUnit } } : null;
  const attendanceAttempt = sourceType === "attempt" ? { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", studentProfileId: sourceStudent, outcome: "REJECTED", session: { id: "abababab-abab-4bab-8bab-abababababab", assessmentId: sourceAssessmentId, courseUnit } } : null;
  const reportId = reportAssessmentId ?? null;
  const item = {
    id: ids.discrepancy,
    studentProfileId: ids.student,
    attendanceRecordId: attendanceRecord?.id ?? (multipleSources ? "aabbccdd-aabb-4ccd-8abb-aabbccddaabb" : null),
    assessmentAttendanceId: assessmentRecord?.id ?? (multipleSources ? "aabbccdd-aabb-4ccd-8abb-aabbccddaabb" : null),
    attendanceAttemptId: attendanceAttempt?.id ?? null,
    assignedLecturerProfileId: ids.lecturerProfile,
    submittedByUserId: ids.user,
    submitterType,
    lecturerReviewedByProfileId: status === "PENDING_COD_REVIEW" && submitterType === "STUDENT" ? ids.lecturerProfile : null,
    lecturerReviewedAt: status === "PENDING_COD_REVIEW" && submitterType === "STUDENT" ? new Date("2026-01-03T10:00:00Z") : null,
    missingMarkReportId: reportMismatch || reportAssessmentId ? ids.report : null,
    missingMarkReport: reportMismatch || reportAssessmentId ? { id: ids.report, studentProfileId: reportMismatch ? ids.otherUser : ids.student, courseUnitId: courseUnit.id, assessmentId: reportId, assessment: reportId ? { id: reportId, courseUnitId: courseUnit.id } : null } : null,
    description: "Attendance source does not match my record",
    status,
    resolution: null,
    createdAt: new Date("2026-01-03T09:00:00Z"),
    updatedAt: new Date("2026-01-03T09:00:00Z"),
    attendanceRecord,
    assessmentRecord,
    attendanceAttempt,
    reporter: { id: ids.user, displayName: "Reporter", email: "reporter@example.test" },
    lecturerReviewer: null,
    comments: [],
  };
  const records = listItems;
  const decisions = structuredClone(initialDecisions);
  const audits = structuredClone(initialAuditEvents);
  const comments = [];
  let capturedWhere;
  const tx = {
    $queryRaw: async () => [{ id: ids.department }],
    departmentMembership: { findMany: async () => [{ departmentId: ids.department }] },
    user: { findFirst: async () => ({ id: ids.user }) },
    department: { findMany: async () => authorized ? [{ id: ids.department }] : [] },
    studentProfile: { findUnique: async () => ({ userId: ids.user }) },
    lecturerProfile: { findUnique: async ({ where }) => {
      if (validationFailure) throw validationFailure;
      return where.id
      ? { id: ids.lecturerProfile, user: { isActive: true, roles: [{ role: { name: "lecturer" } }] } }
      : { id: ids.lecturerProfile };
    } },
    courseUnitLecturer: {
      findUnique: async () => ({ id: "assignment-1" }),
      findFirst: async () => ({ id: "assignment-1" }),
    },
    attendanceDiscrepancy: {
      findUnique: async () => structuredClone(item),
      findMany: async ({ where }) => { capturedWhere = where; return records; },
      count: async () => records.length,
      updateMany: async ({ where, data }) => {
        if (where.status !== item.status || updateCount !== 1) return { count: updateCount };
        Object.assign(item, data);
        return { count: 1 };
      },
    },
    attendanceDiscrepancyDecision: {
      create: async ({ data }) => { const row = { id: `${decisions.length + 1}`, ...data, createdAt: new Date() }; decisions.push(row); return row; },
      findMany: async () => decisions,
      findFirst: async ({ where }) => decisions.filter((row) => row.discrepancyId === where.discrepancyId && (!where.decision || row.decision === where.decision) && (!where.newStatus || row.newStatus === where.newStatus)).sort((a, b) => b.createdAt - a.createdAt || String(b.id).localeCompare(String(a.id)))[0] ?? null,
    },
    attendanceDiscrepancyComment: { findFirst: async ({ where }) => comments.find((row) => row.discrepancyId === where.discrepancyId && row.authorUserId === where.authorUserId && row.clarificationDecisionId === where.clarificationDecisionId) ?? null },
    auditLog: {
      findMany: async () => audits,
      create: async ({ data }) => { if (failAudit) throw new Error("audit write failed"); const row = { id: `${audits.length + 1}`, createdAt: new Date(), ...data }; audits.push(row); return row; },
    },
  };
  const db = {
    ...tx,
    auditLog: { create: async () => { throw new Error("audit must use the transaction client"); } },
    $transaction: async (callback) => {
      const before = structuredClone(item);
      const decisionCount = decisions.length;
      const auditCount = audits.length;
      try { return await callback(tx); }
      catch (error) {
        Object.assign(item, before);
        decisions.length = decisionCount;
        audits.length = auditCount;
        throw error;
      }
    },
  };
  return { db, item, courseUnit, decisions, audits, comments, getWhere: () => capturedWhere };
}

test("COD listing scopes the source-derived department and pagination", async () => {
  const f = makeFixture();
  await listCodAttendanceDiscrepancies({ userId: ids.user, page: 2, limit: 5, db: f.db });
  assert.equal(f.getWhere().OR.length, 3);
  assert.deepEqual(f.getWhere().OR[0].attendanceRecord.is.session.is.courseUnit.is.departmentId, { in: [ids.department] });
});

test("COD listing isolates recognized malformed rows and preserves source-count pagination", async () => {
  const valid = makeFixture();
  const malformed = makeFixture({ multipleSources: true }).item;
  const f = makeFixture({ listItems: [valid.item, malformed] });
  const result = await listCodAttendanceDiscrepancies({ userId: ids.user, page: 1, limit: 20, db: f.db });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.integrity, { skippedRecords: 1 });
  assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 2, totalPages: 1 });
});

test("COD listing propagates unexpected validation failures", async () => {
  const f = makeFixture({ listItems: [makeFixture().item], validationFailure: new Error("unexpected lookup failure") });
  await assert.rejects(listCodAttendanceDiscrepancies({ userId: ids.user, db: f.db }), /unexpected lookup failure/);
});

test("COD cannot retrieve a discrepancy outside currently authorized departments", async () => {
  const f = makeFixture({ authorized: false });
  await assert.rejects(getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db }), { statusCode: 404 });
});

test("multiple or missing attendance sources are rejected", async () => {
  const f = makeFixture({ multipleSources: true });
  await assert.rejects(getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db }), { statusCode: 409 });
  const noSource = makeFixture();
  noSource.item.attendanceRecordId = null;
  noSource.item.attendanceRecord = null;
  await assert.rejects(getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: noSource.db }), { statusCode: 409 });
});

test("a source belonging to another student is rejected", async () => {
  const f = makeFixture({ mismatch: true });
  await assert.rejects(getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db }), { statusCode: 409 });
});

test("incompatible missing-mark report linkage is rejected", async () => {
  const f = makeFixture({ reportMismatch: true });
  await assert.rejects(getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db }), { statusCode: 409 });
});

test("compatible missing-mark report linkage is accepted", async () => {
  const f = makeFixture();
  f.item.missingMarkReportId = ids.report;
  f.item.missingMarkReport = { id: ids.report, studentProfileId: ids.student, courseUnitId: f.courseUnit.id, assessmentId: null, assessment: null };
  const result = await getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db });
  assert.equal(result.missingMarkReport.id, ids.report);
});

test("student-submitted work cannot be decided before lecturer forwarding", async () => {
  const f = makeFixture({ status: "PENDING_LECTURER_REVIEW", submitterType: "STUDENT" });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "CONFIRM_DISCREPANCY", explanation: "Checked", db: f.db }), { statusCode: 409 });
});

test("lecturer-submitted discrepancy is eligible for COD review", async () => {
  const f = makeFixture({ submitterType: "LECTURER" });
  const result = await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "CONFIRM_DISCREPANCY", explanation: "Verified", db: f.db });
  assert.equal(result.status, "CONFIRMED");
});

test("student-submitted discrepancy reaches COD only after assigned lecturer review", async () => {
  const f = makeFixture({ submitterType: "STUDENT" });
  const result = await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "CONFIRM_DISCREPANCY", explanation: "Reviewed after forwarding", db: f.db });
  assert.equal(result.status, "CONFIRMED");
});

test("four COD review decisions persist explanation, actor, status transition and audit", async () => {
  const outcomes = {
    CONFIRM_DISCREPANCY: "CONFIRMED",
    REJECT_DISCREPANCY: "REJECTED",
    REQUEST_CLARIFICATION: "CLARIFICATION_REQUESTED",
    RECOMMEND_CORRECTION: "CORRECTION_RECOMMENDED",
  };
  for (const [decision, status] of Object.entries(outcomes)) {
    const f = makeFixture();
    const sourceBefore = structuredClone(f.item.attendanceRecord);
    const result = await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision, explanation: "Reviewed with source evidence", db: f.db });
    assert.equal(result.status, status);
    assert.equal(f.decisions[0].actorUserId, ids.user);
    assert.equal(f.decisions[0].explanation, "Reviewed with source evidence");
    assert.equal(f.decisions[0].previousStatus, "PENDING_COD_REVIEW");
    assert.equal(f.decisions[0].newStatus, status);
    assert.equal(f.audits[0].actorId, ids.user);
    assert.equal(f.audits[0].entityType, "AttendanceDiscrepancy");
    assert.deepEqual(f.item.attendanceRecord, sourceBefore);
  }
});

test("correction authorization follows a recommendation and records the authorized source status", async () => {
  const f = makeFixture();
  await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "RECOMMEND_CORRECTION", explanation: "Recommend correcting the record", db: f.db });
  const result = await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "AUTHORIZE_ATTENDANCE_CORRECTION", explanation: "Authorized after review", db: f.db });
  assert.equal(result.status, "CORRECTION_AUTHORIZED");
  assert.equal(result.decision.previousStatus, "CORRECTION_RECOMMENDED");
  assert.equal(result.decision.sourceStatusAtAuthorization, "PRESENT");
  assert.equal(f.item.attendanceRecord.status, "PRESENT");
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "AUTHORIZE_ATTENDANCE_CORRECTION", explanation: "Repeat", db: f.db }), { statusCode: 409 });
});

test("correction authorization before recommendation returns 409 without writes", async () => {
  const f = makeFixture();
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "AUTHORIZE_ATTENDANCE_CORRECTION", explanation: "Authorize", db: f.db }), { statusCode: 409 });
  assert.equal(f.decisions.length, 0);
  assert.equal(f.audits.length, 0);
});

const legacyAuthorization = { id: "99999999-9999-4999-8999-999999999998", discrepancyId: ids.discrepancy, actorUserId: ids.user, decision: "AUTHORIZE_ATTENDANCE_CORRECTION", previousStatus: "CORRECTION_RECOMMENDED", newStatus: "CORRECTION_AUTHORIZED", sourceStatusAtAuthorization: null, createdAt: new Date("2026-01-04T09:00:00Z") };
const legacyRecommendation = { id: "99999999-9999-4999-8999-999999999997", discrepancyId: ids.discrepancy, actorUserId: ids.user, decision: "RECOMMEND_CORRECTION", previousStatus: "PENDING_COD_REVIEW", newStatus: "CORRECTION_RECOMMENDED", createdAt: new Date("2026-01-03T09:00:00Z") };
const legacyAuthorizationAudit = { id: "legacy-audit", entityType: "AttendanceDiscrepancy", entityId: ids.discrepancy, actorId: ids.user, action: "COD_ATTENDANCE_DISCREPANCY_AUTHORIZE_ATTENDANCE_CORRECTION", metadata: { decisionId: legacyAuthorization.id }, createdAt: new Date("2026-01-04T09:00:01Z") };

test("designated COD revalidates a legacy authorization with a fresh source snapshot and preserves original history", async () => {
  const f = makeFixture({ status: "CORRECTION_AUTHORIZED", initialDecisions: [legacyRecommendation, legacyAuthorization], initialAuditEvents: [legacyAuthorizationAudit] });
  const sourceBefore = structuredClone(f.item.attendanceRecord);
  const result = await revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Freshly verified the session register", db: f.db });
  assert.equal(result.decision.decision, "REVALIDATE_LEGACY_AUTHORIZATION");
  assert.equal(result.decision.actorUserId, ids.user);
  assert.equal(result.decision.revalidatesDecisionId, legacyAuthorization.id);
  assert.equal(result.decision.sourceTypeAtAuthorization, "ATTENDANCE_RECORD");
  assert.equal(result.decision.sourceIdAtAuthorization, f.item.attendanceRecord.id);
  assert.equal(result.decision.sourceStatusAtAuthorization, "PRESENT");
  assert.equal(f.decisions[1].id, legacyAuthorization.id);
  assert.equal(f.decisions[1].sourceStatusAtAuthorization, null);
  assert.deepEqual(f.item.attendanceRecord, sourceBefore);
  assert.equal(f.audits[1].action, "COD_ATTENDANCE_CORRECTION_AUTHORIZATION_REVALIDATED");
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Repeat revalidation", db: f.db }), { statusCode: 409 });
  assert.equal(f.decisions.length, 3);
});

test("COD revalidation rejects an unauthorized department without writing history", async () => {
  const f = makeFixture({ status: "CORRECTION_AUTHORIZED", authorized: false, initialDecisions: [legacyRecommendation, legacyAuthorization], initialAuditEvents: [legacyAuthorizationAudit] });
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Revalidate", db: f.db }), { statusCode: 404 });
  assert.equal(f.decisions.length, 2);
  assert.equal(f.audits.length, 1);
});

test("COD revalidation rejects an authorization that already has a source snapshot", async () => {
  const f = makeFixture({ status: "CORRECTION_AUTHORIZED", initialDecisions: [legacyRecommendation, { ...legacyAuthorization, sourceStatusAtAuthorization: "PRESENT" }], initialAuditEvents: [legacyAuthorizationAudit] });
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Revalidate", db: f.db }), { statusCode: 409 });
  assert.equal(f.decisions.length, 2);
});

test("COD revalidation rejects a legacy decision without matching original audit history", async () => {
  const f = makeFixture({ status: "CORRECTION_AUTHORIZED", initialDecisions: [legacyRecommendation, legacyAuthorization] });
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Revalidate", db: f.db }), { statusCode: 409 });
  assert.equal(f.decisions.length, 2);
  assert.equal(f.audits.length, 0);
});

test("COD revalidation rejects missing and non-session sources", async () => {
  const missing = makeFixture({ status: "CORRECTION_AUTHORIZED", multipleSources: true, initialDecisions: [legacyRecommendation, legacyAuthorization], initialAuditEvents: [legacyAuthorizationAudit] });
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Revalidate", db: missing.db }), { statusCode: 409 });
  const noSource = makeFixture({ sourceType: "none", status: "CORRECTION_AUTHORIZED", initialDecisions: [legacyRecommendation, legacyAuthorization], initialAuditEvents: [legacyAuthorizationAudit] });
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Revalidate", db: noSource.db }), { statusCode: 409 });
  const nonSession = makeFixture({ status: "CORRECTION_AUTHORIZED", sourceType: "assessment", initialDecisions: [legacyRecommendation, legacyAuthorization], initialAuditEvents: [legacyAuthorizationAudit] });
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Revalidate", db: nonSession.db }), { statusCode: 409 });
  assert.equal(nonSession.decisions.length, 2);
});

test("COD revalidation audit failure rolls back only the new decision and preserves the legacy authorization", async () => {
  const f = makeFixture({ status: "CORRECTION_AUTHORIZED", failAudit: true, initialDecisions: [legacyRecommendation, legacyAuthorization], initialAuditEvents: [legacyAuthorizationAudit] });
  await assert.rejects(revalidateLegacyAttendanceCorrectionAuthorization({ userId: ids.user, discrepancyId: ids.discrepancy, explanation: "Revalidate", db: f.db }), /audit write failed/);
  assert.equal(f.decisions.length, 2);
  assert.equal(f.decisions[1].id, legacyAuthorization.id);
  assert.equal(f.item.status, "CORRECTION_AUTHORIZED");
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].id, legacyAuthorizationAudit.id);
});

test("correction recommendations and authorization are rejected for assessment and attempt sources", async () => {
  for (const sourceType of ["assessment", "attempt"]) {
    const f = makeFixture({ sourceType });
    await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "RECOMMEND_CORRECTION", explanation: "Recommend correction", db: f.db }), { statusCode: 409 });
    assert.equal(f.decisions.length, 0);
  }
});

test("terminal discrepancies reject additional COD decisions", async () => {
  const f = makeFixture({ status: "CONFIRMED" });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REJECT_DISCREPANCY", explanation: "Repeat", db: f.db }), { statusCode: 409 });
  assert.equal(f.decisions.length, 0);
});

test("conditional discrepancy updates reject concurrent COD decisions", async () => {
  const f = makeFixture({ updateCount: 0 });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "CONFIRM_DISCREPANCY", explanation: "Confirm", db: f.db }), { statusCode: 409 });
  assert.equal(f.decisions.length, 0);
  assert.equal(f.audits.length, 0);
});

test("a response linked to the latest clarification decision permits a later COD decision", async () => {
  const f = makeFixture();
  await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", explanation: "Please provide the signed register", db: f.db });
  f.comments.push({ id: "clarification-1", discrepancyId: ids.discrepancy, clarificationDecisionId: f.decisions[0].id, authorUserId: ids.user, body: "The signed register is attached" });
  await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REJECT_DISCREPANCY", explanation: "Evidence did not support the claim", db: f.db });
  assert.equal(f.decisions.length, 2);
  assert.equal(f.decisions[0].decision, "REQUEST_CLARIFICATION");
  assert.equal(f.decisions[1].previousStatus, "CLARIFICATION_REQUESTED");
});

test("a response linked to an older clarification request is rejected", async () => {
  const f = makeFixture({ status: "CLARIFICATION_REQUESTED" });
  f.decisions.push(
    { id: "clarification-old", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-01T00:00:00Z") },
    { id: "clarification-latest", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-02T00:00:00Z") },
  );
  f.comments.push({ id: "old-response", discrepancyId: ids.discrepancy, clarificationDecisionId: "clarification-old", authorUserId: ids.user });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REJECT_DISCREPANCY", explanation: "Review", db: f.db }), { statusCode: 409 });
});

test("a clarification response from someone other than the reporter is rejected", async () => {
  const f = makeFixture({ status: "CLARIFICATION_REQUESTED" });
  f.decisions.push({ id: "clarification-latest", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date() });
  f.comments.push({ id: "wrong-reporter-response", discrepancyId: ids.discrepancy, clarificationDecisionId: "clarification-latest", authorUserId: ids.otherUser });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REJECT_DISCREPANCY", explanation: "Review", db: f.db }), { statusCode: 409 });
});

test("an ordinary unlinked comment does not satisfy the clarification response requirement", async () => {
  const f = makeFixture({ status: "CLARIFICATION_REQUESTED" });
  f.decisions.push({ id: "clarification-latest", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date() });
  f.comments.push({ id: "ordinary-comment", discrepancyId: ids.discrepancy, clarificationDecisionId: null, authorUserId: ids.user });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REJECT_DISCREPANCY", explanation: "Review", db: f.db }), { statusCode: 409 });
});

test("record sources reject missing-mark reports for a different linked assessment", async () => {
  const f = makeFixture({ sourceType: "record", sourceAssessmentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", reportAssessmentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
  await assert.rejects(getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db }), { statusCode: 409 });
});

test("attempt sources reject missing-mark reports for a different linked assessment", async () => {
  const f = makeFixture({ sourceType: "attempt", sourceAssessmentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", reportAssessmentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
  await assert.rejects(getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db }), { statusCode: 409 });
});

test("matching assessment linkage is accepted", async () => {
  const assessmentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const f = makeFixture({ sourceType: "record", sourceAssessmentId: assessmentId, reportAssessmentId: assessmentId });
  const result = await getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db });
  assert.equal(result.missingMarkReport.assessmentId, assessmentId);
});

test("class attendance without a session assessment remains compatible with a same-course report", async () => {
  const f = makeFixture({ sourceType: "record", sourceAssessmentId: null, reportAssessmentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
  const result = await getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db });
  assert.equal(result.missingMarkReport.courseUnitId, f.courseUnit.id);
});

test("terminal decision cannot be repeated and decision history is department scoped", async () => {
  const f = makeFixture();
  await recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REJECT_DISCREPANCY", explanation: "Rejected", db: f.db });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "REJECT_DISCREPANCY", explanation: "Again", db: f.db }), { statusCode: 409 });
  assert.equal((await listCodAttendanceDiscrepancyDecisions({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db })).length, 1);
});

test("audit failure rolls back the decision and state update through the transaction", async () => {
  const f = makeFixture({ failAudit: true });
  await assert.rejects(recordCodAttendanceDiscrepancyDecision({ userId: ids.user, discrepancyId: ids.discrepancy, decision: "CONFIRM_DISCREPANCY", explanation: "Reviewed", db: f.db }), /audit write failed/);
  assert.equal(f.item.status, "PENDING_COD_REVIEW");
  assert.equal(f.decisions.length, 0);
  assert.equal(f.audits.length, 0);
});

test("assessment-attendance and attempt sources expose their department through academic relations", async () => {
  for (const sourceType of ["assessment", "attempt"]) {
    const f = makeFixture({ sourceType });
    const result = await getCodAttendanceDiscrepancy({ userId: ids.user, discrepancyId: ids.discrepancy, db: f.db });
    assert.equal(result.courseUnit.departmentId, ids.department);
  }
});
