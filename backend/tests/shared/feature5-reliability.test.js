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
	const roleChanges = [];
	let currentDesignatedCodUserId = "cod-old";
	let targetHasCodRole = false;
	const tx = {
		$queryRaw: async () => [{ id: "dept-1" }],
		department: {
			findUnique: async () => ({ id: "dept-1", designatedCodUserId: currentDesignatedCodUserId }),
			count: async () => 0,
			update: async ({ data }) => { currentDesignatedCodUserId = data.designatedCodUserId; return { id: "dept-1", ...data }; },
		},
		user: { findFirst: async () => ({ id: "cod-new", roles: [{ role: { name: "lecturer" } }, ...(targetHasCodRole ? [{ role: { name: "cod" } }] : [])] }) },
		role: { upsert: async () => ({ id: "cod-role" }) },
		userRole: {
			create: async ({ data }) => { targetHasCodRole = true; roleChanges.push(["create", data]); },
			deleteMany: async ({ where }) => { roleChanges.push(["delete", where]); },
		},
		departmentMembership: {
			findUnique: async () => ({ id: "membership" }),
			create: async () => ({ id: "membership" }),
		},
		appeal: { findMany: async () => [{ id: "appeal-1", reportId: "report-1", reviewDeadlineAt: deadline }] },
		specialCase: { findMany: async () => [{ id: "case-1", reportId: "report-2", reviewDeadlineAt: deadline }] },
		notificationOutbox: { create: async ({ data }) => { events.push(data); return data; } },
		auditLog: { create: async ({ data }) => { audit.push(data); return {}; } },
	};
	const db = { $transaction: (callback) => callback(tx) };
	await designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-new" });
	assert.deepEqual(events.map(({ eventType, recipientUserId }) => [eventType, recipientUserId]), [
		["COD_APPEAL_OVERDUE", "cod-new"],
		["COD_SPECIAL_CASE_OVERDUE", "cod-new"],
	]);
	assert.ok(events.every(({ availableAt }) => availableAt.valueOf() === deadline.valueOf() + 1));
	assert.ok(events.every(({ dedupeKey }) => dedupeKey.endsWith(":cod-new")));
	await designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-new" });
	assert.equal(events.length, 2);
	assert.deepEqual(roleChanges, [
		["create", { userId: "cod-new", roleId: "cod-role" }],
		["delete", { userId: "cod-old", role: { name: "cod" } }],
	]);
});

test("designation promotes an active approved lecturer and rejects invalid candidates", async () => {
	let savedId;
	let candidateWhere;
	let createdRole;
	let targetHasCodRole = false;
	let createdMembership;
	const demotionAttempts = [];
	const tx = {
		$queryRaw: async () => [{ id: "dept-1" }],
		department: {
			findUnique: async () => ({ id: "dept-1", designatedCodUserId: "cod-1" }),
			count: async () => 1,
			update: async ({ data }) => { savedId = data.designatedCodUserId; return { id: "dept-1", ...data }; },
		},
		user: { findFirst: async ({ where }) => { candidateWhere = where; return where.id === "lecturer-valid" ? { id: where.id, roles: [{ role: { name: "lecturer" } }, ...(targetHasCodRole ? [{ role: { name: "cod" } }] : [])] } : null; } },
		role: { upsert: async () => ({ id: "cod-role" }) },
		userRole: { create: async ({ data }) => { targetHasCodRole = true; createdRole = data; }, deleteMany: async (args) => { demotionAttempts.push(args); } },
		departmentMembership: { findUnique: async () => null, create: async ({ data }) => { createdMembership = data; return { id: "membership" }; } },
		appeal: { findMany: async () => [] },
		specialCase: { findMany: async () => [] },
		missingMarkReport: { findMany: async () => [] },
		auditLog: { create: async () => ({ id: "audit-1" }) },
	};
	const db = { $transaction: (callback) => callback(tx) };
	await designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "lecturer-valid" });
	assert.equal(savedId, "lecturer-valid");
	assert.equal(candidateWhere.isActive, true);
	assert.equal(candidateWhere.approvalStatus, "APPROVED");
	assert.deepEqual(candidateWhere.roles, { some: { role: { name: "lecturer" } } });
	assert.deepEqual(createdRole, { userId: "lecturer-valid", roleId: "cod-role" });
	assert.deepEqual(createdMembership, { userId: "lecturer-valid", departmentId: "dept-1" });
	assert.deepEqual(demotionAttempts, []);
	for (const codUserId of ["inactive", "unapproved", "not-a-lecturer"]) {
		await assert.rejects(designateDepartmentCod({ db, actorUserId: "admin-1", departmentId: "dept-1", codUserId }), { statusCode: 422 });
	}
});
