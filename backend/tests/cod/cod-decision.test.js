import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { codRoutes } = await import("../../src/modules/cod/cod.routes.js");
const { codReportDecisionBodySchema } = await import("../../src/modules/cod/cod.validation.js");
const { decideEscalatedReport, getCodReportDetails, listDepartmentReports } = await import("../../src/modules/cod/cod.service.js");

const makeDecisionDb = ({
  departments = ["dept-1"],
  status = "ESCALATED",
  updateCount = 1,
  historyFailure = null,
  auditFailure = null,
} = {}) => {
  const calls = {};
  const report = { id: "report-1", status, courseUnitId: "unit-1", courseUnit: { departmentId: "dept-1" } };
  let persistedStatus = status;
  const tx = {
    missingMarkReport: {
      findUnique: async (args) => { calls.reportLookup = args; return report; },
      updateMany: async (args) => {
        calls.updateArgs = args;
        if (updateCount === 1) persistedStatus = args.data.status;
        return { count: updateCount };
      },
    },
    departmentMembership: {
      findMany: async (args) => { calls.membershipArgs = args; return departments.map((departmentId) => ({ departmentId })); },
    },
    reportStatusHistory: {
      create: async (args) => {
        calls.historyArgs = args;
        if (historyFailure) throw historyFailure;
        return { id: "history-cod", ...args.data, createdAt: new Date("2026-11-03T10:00:00.000Z") };
      },
    },
    auditLog: {
      create: async (args) => {
        calls.auditArgs = args;
        if (auditFailure) throw auditFailure;
        return { id: "audit-cod", ...args.data };
      },
    },
  };
  const db = {
    $transaction: async (callback) => {
      calls.transactionStarted = true;
      const startingStatus = persistedStatus;
      try {
        const result = await callback(tx);
        calls.persistedStatus = persistedStatus;
        return result;
      } catch (error) {
        persistedStatus = startingStatus;
        calls.persistedStatus = persistedStatus;
        throw error;
      }
    },
  };
  return { db, calls };
};

test("registers COD final decision behind COD router authentication and role middleware", () => {
  const route = codRoutes.stack.find((layer) =>
    layer.route?.path === "/reports/:id/decision" && layer.route.methods.post
  );
  assert.ok(route);
  assert.equal(route.route.stack.length, 3); // params validation, body validation, controller
  assert.equal(codRoutes.stack.filter((layer) => !layer.route).length >= 2, true);
  for (const handler of route.route.stack) assert.equal(typeof handler.handle, "function");
});

test("COD decision route rejects unauthenticated and non-COD users at its router guards", async () => {
  let unauthenticatedError;
  await codRoutes.stack[0].handle({ get: () => undefined, cookies: {} }, {}, (error) => { unauthenticatedError = error; });
  assert.equal(unauthenticatedError.statusCode, 401);

  let roleError;
  codRoutes.stack[1].handle({ user: { roles: ["student"] } }, {}, (error) => { roleError = error; });
  assert.equal(roleError.statusCode, 403);
});

test("validates only APPROVE or REJECT with a trimmed, required reason", () => {
  assert.equal(codReportDecisionBodySchema.safeParse({ decision: "APPROVE", reason: " Review " }).data.reason, "Review");
  for (const body of [
    { decision: "ESCALATE", reason: "Review" },
    { decision: "APPROVE", reason: "   " },
    { decision: "REJECT", reason: "x".repeat(2001) },
    { decision: "APPROVE" },
  ]) assert.equal(codReportDecisionBodySchema.safeParse(body).success, false);
});

for (const [decision, status] of [["APPROVE", "APPROVED"], ["REJECT", "REJECTED"]]) {
  test(`records COD ${decision} for an authorized escalated report transactionally`, async () => {
    const { db, calls } = makeDecisionDb();
    const result = await decideEscalatedReport({
      actorUserId: "cod-user-1", reportId: "report-1", decision,
      reason: "Reviewed the escalated case.", db,
    });
    assert.equal(result.status, status);
    assert.deepEqual(calls.updateArgs, { where: { id: "report-1", status: "ESCALATED" }, data: { status } });
    assert.deepEqual(calls.historyArgs.data, {
      reportId: "report-1", actorUserId: "cod-user-1", previousStatus: "ESCALATED",
      newStatus: status, reason: "Reviewed the escalated case.",
    });
    assert.equal(calls.auditArgs.data.actorId, "cod-user-1");
    assert.equal(calls.auditArgs.data.action, "COD_REPORT_DECISION_RECORDED");
    assert.equal(calls.transactionStarted, true);
  });
}

test("rejects COD decisions outside the authorized department", async () => {
  const { db, calls } = makeDecisionDb({ departments: ["dept-2"] });
  await assert.rejects(
    () => decideEscalatedReport({ actorUserId: "cod-user-1", reportId: "report-1", decision: "APPROVE", reason: "Review.", db }),
    { statusCode: 403 },
  );
  assert.equal(calls.updateArgs, undefined);
});

test("rejects a COD decision when the report is not escalated", async () => {
  const { db, calls } = makeDecisionDb({ status: "PENDING" });
  await assert.rejects(
    () => decideEscalatedReport({ actorUserId: "cod-user-1", reportId: "report-1", decision: "REJECT", reason: "Review.", db }),
    { statusCode: 409 },
  );
  assert.equal(calls.updateArgs, undefined);
});

test("rejects repeated or concurrent COD decisions when the conditional update loses the race", async () => {
  const { db, calls } = makeDecisionDb({ updateCount: 0 });
  await assert.rejects(
    () => decideEscalatedReport({ actorUserId: "cod-user-1", reportId: "report-1", decision: "APPROVE", reason: "Review.", db }),
    { statusCode: 409 },
  );
  assert.equal(calls.historyArgs, undefined);
  assert.equal(calls.auditArgs, undefined);
});

test("fails COD decision transaction if history creation fails", async () => {
  const { db, calls } = makeDecisionDb({ historyFailure: new Error("History insert failed") });
  await assert.rejects(
    () => decideEscalatedReport({ actorUserId: "cod-user-1", reportId: "report-1", decision: "APPROVE", reason: "Review.", db }),
    { message: "History insert failed" },
  );
  assert.equal(calls.auditArgs, undefined);
  assert.equal(calls.persistedStatus, "ESCALATED");
});

test("fails COD decision transaction if audit creation fails", async () => {
  const { db, calls } = makeDecisionDb({ auditFailure: new Error("Audit insert failed") });
  await assert.rejects(
    () => decideEscalatedReport({ actorUserId: "cod-user-1", reportId: "report-1", decision: "REJECT", reason: "Review.", db }),
    { message: "Audit insert failed" },
  );
  assert.equal(calls.historyArgs.data.newStatus, "REJECTED");
  assert.equal(calls.auditArgs.data.actorId, "cod-user-1");
  assert.equal(calls.persistedStatus, "ESCALATED");
});

test("escalated COD detail exposes report-scoped decision history and safe evidence metadata only", async () => {
  const calls = {};
  const escalation = {
    id: "history-escalated", actorUserId: "lecturer-user-1", previousStatus: "APPROVED",
    newStatus: "ESCALATED", reason: "Needs COD review.", createdAt: new Date("2026-11-03T08:00:00.000Z"),
    actor: { id: "lecturer-user-1", displayName: "Lecturer" },
  };
  const originalDecision = {
    id: "history-lecturer", actorUserId: "lecturer-user-1", previousStatus: "pending",
    newStatus: "APPROVED", reason: "Lecturer approved.", createdAt: new Date("2026-11-03T07:00:00.000Z"),
    actor: { id: "lecturer-user-1", displayName: "Lecturer" },
  };
  const report = {
    id: "report-1", reference: "MM-001", status: "ESCALATED", submittedAt: null,
    createdAt: new Date(), updatedAt: new Date(), studentProfileId: "student-1",
    courseUnitId: "unit-1", academicPeriodId: "period-1", assessment: null,
    student: { id: "student-1", studentNumber: "S-1", officialEmail: "s@example.test" },
    courseUnit: { id: "unit-1", code: "U1", name: "Unit", departmentId: "dept-1" },
    academicPeriod: { id: "period-1", code: "P1", name: "Period", startsAt: null, endsAt: null },
    assignedLecturer: null,
    statusHistory: [originalDecision, escalation],
    evidence: [{ id: "evidence-1", originalName: "scan.pdf", storageKey: "private-object-key", mediaType: "application/pdf", sizeBytes: 123, createdAt: new Date(), uploadedBy: { id: "uploader-1", displayName: "Uploader" } }],
  };
  const db = {
    departmentMembership: { findMany: async () => [{ departmentId: "dept-1" }] },
    missingMarkReport: { findFirst: async (args) => { calls.reportWhere = args.where; return report; } },
    unitEnrollment: { findUnique: async () => null },
    auditLog: { findMany: async (args) => { calls.auditWhere = args.where; return [{ id: "audit-1", action: "REPORT_ESCALATED", actorId: "lecturer-user-1", metadata: {}, createdAt: new Date(), actor: { id: "lecturer-user-1", displayName: "Lecturer" } }]; } },
  };
  const result = await getCodReportDetails({ userId: "cod-user-1", reportId: "report-1", db });
  assert.deepEqual(calls.reportWhere.courseUnit.departmentId.in, ["dept-1"]);
  assert.deepEqual(calls.auditWhere, { entityType: "MissingMarkReport", entityId: "report-1" });
  assert.equal(result.lecturerDecisionReview.lecturerDecision.decision, "APPROVED");
  assert.equal(result.lecturerDecisionReview.lecturerDecision.reason, "Lecturer approved.");
  assert.equal(result.lecturerDecisionReview.escalationReason, "Needs COD review.");
  assert.equal(result.lecturerDecisionReview.evidenceMetadata[0].originalName, "scan.pdf");
  assert.equal("storageKey" in result.lecturerDecisionReview.evidenceMetadata[0], false);
  assert.equal(result.lecturerDecisionReview.evidenceNotice.includes("contents are not available"), true);
});

test("COD report detail remains department-scoped", async () => {
  let reportWhere;
  const db = {
    departmentMembership: { findMany: async () => [{ departmentId: "dept-2" }] },
    missingMarkReport: { findFirst: async (args) => { reportWhere = args.where; return null; } },
  };
  await assert.rejects(() => getCodReportDetails({ userId: "cod-user-1", reportId: "report-1", db }), { statusCode: 404 });
  assert.deepEqual(reportWhere, { id: "report-1", courseUnit: { departmentId: { in: ["dept-2"] } } });
});

test("existing COD list endpoint can filter to authorized escalated reports", async () => {
  const calls = {};
  const db = {
    departmentMembership: { findMany: async () => [{ departmentId: "dept-1" }] },
    missingMarkReport: {
      count: async ({ where }) => { calls.countWhere = where; return 1; },
      findMany: async ({ where }) => { calls.listWhere = where; return []; },
    },
  };
  const result = await listDepartmentReports({ userId: "cod-user-1", status: "ESCALATED", page: 1, limit: 10, sort: "newest", db });
  assert.equal(result.total, 1);
  assert.deepEqual(calls.listWhere, {
    courseUnit: { departmentId: { in: ["dept-1"] } },
    status: "ESCALATED",
  });
});
