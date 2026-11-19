import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";

const { applyAuthorizedAttendanceCorrection } = await import("../../src/modules/admin/attendance-correction.service.js");

function fixture(overrides = {}) {
	const state = { status: "PRESENT", discrepancyStatus: "CORRECTION_AUTHORIZED", corrections: [], audits: [], historyWrites: 0 };
	let transactionQueue = Promise.resolve();
	const decision = {
		id: "decision-1",
		decision: "AUTHORIZE_ATTENDANCE_CORRECTION",
		newStatus: "CORRECTION_AUTHORIZED",
		sourceStatusAtAuthorization: "PRESENT",
		discrepancy: { id: "discrepancy-1", studentProfileId: "student-1", status: state.discrepancyStatus, attendanceRecordId: "record-1", assessmentAttendanceId: null, attendanceAttemptId: null, attendanceRecord: { id: "record-1", studentProfileId: "student-1", status: state.status } },
		...overrides.decision,
	};
	const originalAuthorization = overrides.originalAuthorization ?? { id: "legacy-decision", discrepancyId: decision.discrepancy.id, decision: "AUTHORIZE_ATTENDANCE_CORRECTION", newStatus: "CORRECTION_AUTHORIZED", sourceStatusAtAuthorization: null };
	const tx = {
		user: { findFirst: async () => Object.hasOwn(overrides, "administrator") ? overrides.administrator : { id: "admin-1" } },
		attendanceDiscrepancyDecision: { findUnique: async ({ where }) => overrides.authorization === false ? null : where.id === decision.id ? decision : originalAuthorization },
		attendanceCorrection: {
			findUnique: async () => overrides.existingCorrection || state.corrections.length ? { id: "correction-existing" } : null,
			create: async ({ data }) => {
				if (overrides.correctionCreateError) throw new Error("correction ledger unavailable");
				const row = { id: "correction-1", ...data, createdAt: new Date("2026-11-07T12:00:00Z") }; state.corrections.push(row); return row;
			},
		},
		attendanceRecord: { updateMany: async ({ where, data }) => {
			if (overrides.recordUpdateCount === 0 || state.status !== where.status) return { count: 0 };
			state.status = data.status;
			return { count: 1 };
		} },
		attendanceDiscrepancy: { updateMany: async ({ where, data }) => {
			if (overrides.discrepancyUpdateCount === 0 || state.discrepancyStatus !== where.status) return { count: 0 };
			state.discrepancyStatus = data.status;
			return { count: 1 };
		} },
		auditLog: { create: async ({ data }) => { if (overrides.auditError) throw new Error("audit store unavailable"); state.audits.push(data); return { id: "audit-1", ...data }; } },
	};
	const db = { $transaction: (callback) => {
		const run = transactionQueue.then(async () => {
			const snapshot = structuredClone(state);
			try { return await callback(tx); }
			catch (error) { Object.assign(state, snapshot); throw error; }
		});
		transactionQueue = run.catch(() => undefined);
		return run;
	} };
	return { db, state, decision };
}

const request = { administratorUserId: "admin-1", discrepancyDecisionId: "decision-1", correctedStatus: "ABSENT", reason: "Verified signed register" };

test("Admin applies a valid COD authorization transactionally and preserves AttendanceHistory", async () => {
	const f = fixture();
	const result = await applyAuthorizedAttendanceCorrection({ ...request, db: f.db });
	assert.equal(result.originalStatus, "PRESENT");
	assert.equal(result.correctedStatus, "ABSENT");
	assert.equal(result.administratorUserId, "admin-1");
	assert.equal(f.state.status, "ABSENT");
	assert.equal(f.state.discrepancyStatus, "CORRECTION_APPLIED");
	assert.equal(f.state.corrections.length, 1);
	assert.equal(f.state.audits[0].action, "ADMIN_ATTENDANCE_CORRECTION_APPLIED");
	assert.equal(f.state.historyWrites, 0);
});

test("only an active administrator may apply a correction", async () => {
	const f = fixture({ administrator: null });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), { statusCode: 403 });
});

test("a correction without a COD authorization is concealed", async () => {
	const f = fixture({ authorization: false });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), { statusCode: 404 });
});

test("authorization from a different decision or state is rejected", async () => {
	const f = fixture({ decision: { decision: "RECOMMEND_CORRECTION" } });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), { statusCode: 409 });
});

test("Admin rejects a legacy authorization until COD creates a fresh revalidation", async () => {
	const f = fixture({ decision: { sourceStatusAtAuthorization: null } });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), { statusCode: 409 });
	assert.equal(f.state.corrections.length, 0);
	assert.equal(f.state.status, "PRESENT");
});

function freshRevalidationDecision(overrides = {}) {
	return {
		id: "fresh-decision",
		decision: "REVALIDATE_LEGACY_AUTHORIZATION",
		newStatus: "CORRECTION_AUTHORIZED",
		sourceStatusAtAuthorization: "PRESENT",
		sourceTypeAtAuthorization: "ATTENDANCE_RECORD",
		sourceIdAtAuthorization: "record-1",
		revalidatesDecisionId: "legacy-decision",
		...overrides,
	};
}

test("Admin accepts a valid fresh revalidation and records its audit event", async () => {
	const f = fixture({ decision: freshRevalidationDecision() });
	const result = await applyAuthorizedAttendanceCorrection({ ...request, discrepancyDecisionId: "fresh-decision", db: f.db });
	assert.equal(result.originalStatus, "PRESENT");
	assert.equal(f.state.status, "ABSENT");
	assert.equal(f.state.corrections[0].discrepancyDecisionId, "fresh-decision");
	assert.equal(f.state.audits.length, 1);
});

test("Admin rejects a fresh authorization when its source status changed after revalidation", async () => {
	const f = fixture({ decision: freshRevalidationDecision({ sourceStatusAtAuthorization: "ABSENT" }) });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, discrepancyDecisionId: "fresh-decision", db: f.db }), { statusCode: 409 });
	assert.equal(f.state.corrections.length, 0);
	assert.equal(f.state.status, "PRESENT");
});

test("concurrent correction attempts cannot reuse one fresh authorization", async () => {
	const f = fixture({ decision: freshRevalidationDecision() });
	const freshRequest = { ...request, discrepancyDecisionId: "fresh-decision", db: f.db };
	const results = await Promise.allSettled([
		applyAuthorizedAttendanceCorrection(freshRequest),
		applyAuthorizedAttendanceCorrection(freshRequest),
	]);
	assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
	assert.equal(results.filter(({ status, reason }) => status === "rejected" && reason?.statusCode === 409).length, 1);
	assert.equal(f.state.corrections.length, 1);
});

test("assessment and attempt discrepancies are not applied as session record corrections", async () => {
	for (const source of [
		{ attendanceRecordId: null, assessmentAttendanceId: "assessment-1", attendanceAttemptId: null, attendanceRecord: null },
		{ attendanceRecordId: null, assessmentAttendanceId: null, attendanceAttemptId: "attempt-1", attendanceRecord: null },
	]) {
		const f = fixture({ decision: { discrepancy: { ...fixture().decision.discrepancy, ...source } } });
		await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), { statusCode: 409 });
	}
});

test("an authorization cannot be applied twice", async () => {
	const f = fixture({ existingCorrection: true });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), { statusCode: 409 });
});

test("concurrent attempts to apply one authorization commit at most once", async () => {
	const f = fixture();
	const results = await Promise.allSettled([
		applyAuthorizedAttendanceCorrection({ ...request, db: f.db }),
		applyAuthorizedAttendanceCorrection({ ...request, db: f.db }),
	]);
	assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
	assert.equal(results.filter(({ status, reason }) => status === "rejected" && reason?.statusCode === 409).length, 1);
	assert.equal(f.state.corrections.length, 1);
	assert.equal(f.state.audits.length, 1);
	assert.equal(f.state.status, "ABSENT");
	assert.equal(f.state.discrepancyStatus, "CORRECTION_APPLIED");
});

test("correction-ledger creation failure rolls back the attendance update", async () => {
	const f = fixture({ correctionCreateError: true });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), /correction ledger unavailable/);
	assert.equal(f.state.status, "PRESENT");
	assert.equal(f.state.discrepancyStatus, "CORRECTION_AUTHORIZED");
	assert.equal(f.state.corrections.length, 0);
	assert.equal(f.state.audits.length, 0);
});

test("discrepancy update failure rolls back the attendance update and correction row", async () => {
	const f = fixture({ discrepancyUpdateCount: 0 });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), { statusCode: 409 });
	assert.equal(f.state.status, "PRESENT");
	assert.equal(f.state.discrepancyStatus, "CORRECTION_AUTHORIZED");
	assert.equal(f.state.corrections.length, 0);
	assert.equal(f.state.audits.length, 0);
});

test("audit failure rolls back the attendance update, correction row and discrepancy state", async () => {
	const f = fixture({ auditError: true });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: f.db }), /audit store unavailable/);
	assert.equal(f.state.status, "PRESENT");
	assert.equal(f.state.discrepancyStatus, "CORRECTION_AUTHORIZED");
	assert.equal(f.state.corrections.length, 0);
	assert.equal(f.state.audits.length, 0);
});

test("changed attendance status and repeated discrepancy state block correction", async () => {
	const stale = fixture({ decision: { sourceStatusAtAuthorization: "ABSENT" } });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: stale.db }), { statusCode: 409 });
	const recordRace = fixture({ recordUpdateCount: 0 });
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, db: recordRace.db }), { statusCode: 409 });
});

test("same status cannot be recorded as an actual correction", async () => {
	const f = fixture();
	await assert.rejects(applyAuthorizedAttendanceCorrection({ ...request, correctedStatus: "PRESENT", db: f.db }), { statusCode: 409 });
});
