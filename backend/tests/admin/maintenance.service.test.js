import test from "node:test";
import assert from "node:assert/strict";
import { reopenReport, reassignReport } from "../../src/modules/admin/maintenance.service.js";

const reportId = "00000000-0000-4000-8000-000000000001";
const departmentId = "00000000-0000-4000-8000-000000000002";

function dbFor(status, { openAppeal = false } = {}) {
	const tx = {
		$queryRaw: async () => [{ id: departmentId }],
		missingMarkReport: { findUnique: async () => ({ id: reportId, status, assignedLecturerProfileId: null, courseUnitId: "unit", courseUnit: { departmentId } }) },
		appeal: { findFirst: async () => openAppeal ? { id: "appeal" } : null },
		specialCase: { findFirst: async () => null },
	};
	return { $transaction: async (callback) => callback(tx) };
}

test("reopening rejects reports that are not rejected or withdrawn", async () => {
	await assert.rejects(reopenReport({ db: dbFor("PENDING"), actorUserId: "actor", reportId, reason: "reason" }), (error) => error.statusCode === 409);
});

test("reopening rejects reports with an unresolved appeal", async () => {
	await assert.rejects(reopenReport({ db: dbFor("REJECTED", { openAppeal: true }), actorUserId: "actor", reportId, reason: "reason" }), (error) => error.statusCode === 409);
});

test("reassignment rejects terminal reports", async () => {
	await assert.rejects(reassignReport({ db: dbFor("REJECTED"), actorUserId: "actor", reportId, lecturerProfileId: "lecturer", reason: "reason" }), (error) => error.statusCode === 409);
});