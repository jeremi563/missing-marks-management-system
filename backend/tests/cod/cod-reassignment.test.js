import test from "node:test";
import assert from "node:assert/strict";
import { reassignCodReport } from "../../src/modules/cod/cod.service.js";

function createDb(authorized) {
	const reassignment = {};
	const report = {
		id: "report-1",
		status: "PENDING",
		assignedLecturerProfileId: "lecturer-old",
		courseUnitId: "unit-1",
		courseUnit: { departmentId: "department-1" },
		academicPeriod: { name: "Semester 1", code: "2026", startsAt: new Date("2026-09-01T00:00:00+03:00") },
	};
	const tx = {
		missingMarkReport: {
			findUnique: async () => report,
			updateMany: async (query) => { reassignment.update = query; return { count: 1 }; },
		},
		departmentMembership: { findMany: async () => [{ departmentId: "department-1" }] },
		user: { findFirst: async () => ({ id: "cod-1" }) },
		department: { findMany: async () => authorized ? [{ id: "department-1" }] : [] },
		$queryRaw: async () => [{ id: "department-1" }],
		appeal: { findFirst: async () => null },
		specialCase: { findFirst: async () => null },
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-new" }) },
		reportAssignment: { create: async ({ data }) => { reassignment.assignment = data; return data; } },
		reportStatusHistory: { create: async () => assert.fail("PENDING reassignment must not add a status transition") },
		auditLog: { create: async ({ data }) => { reassignment.audit = data; return data; } },
	};
	return {
		reassignment,
		db: { $transaction: async (operation) => operation(tx) },
	};
}

test("designated COD can reassign an outstanding report to an active year-matched lecturer", async () => {
	const { db, reassignment } = createDb(true);
	await reassignCodReport({
		db,
		userId: "cod-1",
		reportId: "report-1",
		lecturerProfileId: "lecturer-new",
		reason: "The prior lecturer is no longer assigned.",
	});
	assert.equal(reassignment.update.data.assignedLecturerProfileId, "lecturer-new");
	assert.deepEqual(reassignment.assignment, {
		reportId: "report-1",
		actorUserId: "cod-1",
		previousLecturerProfileId: "lecturer-old",
		newLecturerProfileId: "lecturer-new",
		reason: "The prior lecturer is no longer assigned.",
	});
	assert.equal(reassignment.audit.action, "COD_REPORT_REASSIGNED");
});

test("COD cannot reassign an outstanding report outside its designated department", async () => {
	const { db, reassignment } = createDb(false);
	await assert.rejects(reassignCodReport({
		db,
		userId: "cod-1",
		reportId: "report-1",
		lecturerProfileId: "lecturer-new",
		reason: "Unauthorized department.",
	}), { statusCode: 404 });
	assert.equal(reassignment.update, undefined);
	assert.equal(reassignment.assignment, undefined);
});
