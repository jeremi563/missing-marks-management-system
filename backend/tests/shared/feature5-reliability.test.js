import test from "node:test";
import assert from "node:assert/strict";
import { createSpecialCase, designateDepartmentCod } from "../../src/shared/services/feature5.service.js";

function specialCaseDb(role) {
	const calls = { created: 0, events: 0 };
	const tx = {
		$queryRaw: async () => [{ id: "dept-1" }],
		missingMarkReport: { findUnique: async () => ({ id: "report-1", status: "PENDING", studentProfileId: "student-profile", assignedLecturerProfileId: "lecturer-profile", courseUnit: { department: { id: "dept-1", designatedCodUserId: "inactive-cod" } } }) },
		user: { findFirst: async () => null },
		studentProfile: { findUnique: async () => ({ id: "student-profile" }) },
		lecturerProfile: { findUnique: async () => ({ id: "lecturer-profile" }) },
		specialCaseCategory: { findFirst: async () => ({ id: "category-1", name: "Other" }) },
		specialCase: { create: async () => { calls.created += 1; return {}; } },
		notificationOutbox: { create: async () => { calls.events += 1; return {}; } },
		auditLog: { create: async () => ({ id: "audit-1" }) },
	};
	return { calls, db: { $transaction: (callback) => callback(tx) }, role };
}

for (const role of ["student", "lecturer"]) {
	test(`${role} special case without a valid designated COD creates no case or outbox event`, async () => {
		const { db, calls } = specialCaseDb(role);
		await assert.rejects(createSpecialCase({ db, userId: `${role}-user`, role, reportId: "report-1", categoryId: "category-1", description: "Please review." }), {
			statusCode: 409,
			message: "This department currently has no valid designated COD, so the submission cannot proceed",
		});
		assert.equal(calls.created, 0);
		assert.equal(calls.events, 0);
	});
}

test("replacing a COD queues outstanding future and overdue reviews for the new COD", async () => {
	const deadline = new Date("2026-12-01T10:00:00.000Z");
	const events = [];
	const audit = [];
	let currentDesignatedCodUserId = "cod-old";
	const tx = {
		$queryRaw: async () => [{ id: "dept-1" }],
		department: {
			findUnique: async () => ({ id: "dept-1", designatedCodUserId: currentDesignatedCodUserId }),
			update: async ({ data }) => { currentDesignatedCodUserId = data.designatedCodUserId; return { id: "dept-1", ...data }; },
		},
		user: { findFirst: async () => ({ id: "cod-new" }) },
		appeal: { findMany: async () => [{ id: "appeal-1", reportId: "report-1", reviewDeadlineAt: deadline }] },
		specialCase: { findMany: async () => [{ id: "case-1", reportId: "report-2", reviewDeadlineAt: deadline }] },
		missingMarkReport: { findMany: async () => [{ id: "report-3", assignedLecturerProfileId: "lecturer-profile", assignments: [{ id: "assignment-1", deadlineAt: deadline, workStartedAt: new Date("2026-11-20T10:00:00Z"), newLecturerProfileId: "lecturer-profile" }] }] },
		notificationOutbox: { create: async ({ data }) => { events.push(data); return data; } },
		auditLog: { create: async ({ data }) => { audit.push(data); return {}; } },
	};
	const db = { $transaction: (callback) => callback(tx) };
	await designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-new" });
	assert.deepEqual(events.map(({ eventType, recipientUserId }) => [eventType, recipientUserId]), [
		["COD_APPEAL_OVERDUE", "cod-new"],
		["COD_SPECIAL_CASE_OVERDUE", "cod-new"],
		["COD_REPORT_OVERDUE", "cod-new"],
	]);
	assert.ok(events.every(({ availableAt }) => availableAt.valueOf() === deadline.valueOf() + 1));
	assert.ok(events.every(({ dedupeKey }) => dedupeKey.endsWith(":cod-new")));
	await designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-new" });
	assert.equal(events.length, 3);
});

test("designation accepts a valid active departmental COD and rejects invalid candidates", async () => {
	let savedId;
	let candidateWhere;
	const tx = {
		$queryRaw: async () => [{ id: "dept-1" }],
		department: {
			findUnique: async () => ({ id: "dept-1", designatedCodUserId: "cod-1" }),
			update: async ({ data }) => { savedId = data.designatedCodUserId; return { id: "dept-1", ...data }; },
		},
		user: { findFirst: async ({ where }) => { candidateWhere = where; return where.id === "cod-valid" ? { id: where.id } : null; } },
		appeal: { findMany: async () => [] },
		specialCase: { findMany: async () => [] },
		missingMarkReport: { findMany: async () => [] },
		auditLog: { create: async () => ({ id: "audit-1" }) },
	};
	const db = { $transaction: (callback) => callback(tx) };
	await designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-valid" });
	assert.equal(savedId, "cod-valid");
	assert.equal(candidateWhere.isActive, true);
	assert.deepEqual(candidateWhere.roles, { some: { role: { name: "cod" } } });
	assert.deepEqual(candidateWhere.departmentMemberships, { some: { departmentId: "dept-1" } });
	for (const codUserId of ["inactive", "no-role", "not-a-member"]) {
		await assert.rejects(designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId }), { statusCode: 422 });
	}
});
