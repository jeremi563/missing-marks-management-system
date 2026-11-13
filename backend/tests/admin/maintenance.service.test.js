import test from "node:test";
import assert from "node:assert/strict";
import { reopenReport, reassignReport } from "../../src/modules/admin/maintenance.service.js";

const reportId = "00000000-0000-4000-8000-000000000001";
const departmentId = "00000000-0000-4000-8000-000000000002";

function dbFor(status, { openAppeal = false } = {}) {
	const tx = {
		$queryRaw: async () => [{ id: departmentId }],
		missingMarkReport: { findUnique: async () => ({
			id: reportId,
			status,
			assignedLecturerProfileId: null,
			courseUnitId: "unit",
			courseUnit: { departmentId },
			academicPeriod: { name: "2026/27", code: "2026/27", startsAt: null },
		}) },
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

test("reassignment requires the lecturer's unit mapping for the report academic year", async () => {
	let eligibilityQuery;
	const tx = {
		$queryRaw: async () => [{ id: departmentId }],
		missingMarkReport: {
			findUnique: async () => ({
				id: reportId,
				status: "SUBMITTED",
				assignedLecturerProfileId: null,
				courseUnitId: "unit",
				courseUnit: { departmentId },
				academicPeriod: { name: "2026/27", code: "2026/27", startsAt: null },
			}),
			updateMany: async () => ({ count: 1 }),
		},
		appeal: { findFirst: async () => null },
		specialCase: { findFirst: async () => null },
		lecturerProfile: {
			findFirst: async ({ where }) => {
				eligibilityQuery = where.unitAssignments;
				return { id: "lecturer" };
			},
		},
		reportAssignment: { create: async () => ({ id: "assignment" }) },
		reportStatusHistory: { create: async () => ({ id: "history" }) },
		auditLog: { create: async () => {} },
	};

	await reassignReport({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "actor",
		reportId,
		lecturerProfileId: "lecturer",
		reason: "Reassignment",
	});

	assert.deepEqual(eligibilityQuery, { some: { courseUnitId: "unit", academicYear: "2026/27" } });
});