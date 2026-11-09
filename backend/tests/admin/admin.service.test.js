import test from "node:test";
import assert from "node:assert/strict";
import { createAdminUser, decideStaffAccount, updateAdminUser } from "../../src/modules/admin/admin.service.js";

const userId = "00000000-0000-4000-8000-000000000001";

function transactionDb({ roles = ["cod"], designatedDepartments = 0, lecturerCounts = { unitAssignments: 0, assignedReports: 0, attendanceSessions: 0 } } = {}) {
	const current = {
		id: userId,
		displayName: "Staff",
		isActive: true,
		roles: roles.map((name) => ({ role: { name } })),
		studentProfile: null,
		lecturerProfile: roles.includes("lecturer") ? { id: "lecturer-profile", staffNumber: "STAFF-1" } : null,
	};
	const tx = {
		user: { findUnique: async () => current },
		department: { count: async () => designatedDepartments },
		lecturerProfile: { findUnique: async () => ({ _count: lecturerCounts }) },
	};
	return { $transaction: async (callback) => callback(tx) };
}

test("administrator cannot deactivate a designated COD", async () => {
	await assert.rejects(
		updateAdminUser({ db: transactionDb({ designatedDepartments: 1 }), actorUserId: "actor", userId, isActive: false }),
		(error) => error.statusCode === 409,
	);
});

test("administrator cannot remove the COD role while it is designated", async () => {
	await assert.rejects(
		updateAdminUser({ db: transactionDb({ designatedDepartments: 1 }), actorUserId: "actor", userId, roles: ["administrator"] }),
		(error) => error.statusCode === 409,
	);
});

test("administrator cannot deactivate a lecturer with protected academic responsibilities", async () => {
	await assert.rejects(
		updateAdminUser({ db: transactionDb({ roles: ["lecturer"], lecturerCounts: { unitAssignments: 1, assignedReports: 0, attendanceSessions: 0 } }), actorUserId: "actor", userId, isActive: false }),
		(error) => error.statusCode === 409,
	);
});

test("administrator-created COD accounts are active, verified, and use the shared staff identifier", async () => {
	const calls = {};
	const tx = {
		role: { findMany: async () => [{ id: "cod-role", name: "cod" }] },
		user: {
			create: async ({ data }) => { calls.user = data; return { id: userId }; },
			findUnique: async () => ({ id: userId, email: "cod@example.test", displayName: "COD", isActive: true, approvalStatus: "APPROVED", emailVerifiedAt: new Date(), roles: [{ role: { name: "cod" } }], loginIdentifiers: [{ type: "STAFF_NUMBER", value: "COD-1" }], studentProfile: null, lecturerProfile: null }),
		},
		userRole: { createMany: async () => {} },
		accountLoginIdentifier: { findFirst: async () => null, create: async ({ data }) => { calls.identifier = data; } },
		auditLog: { create: async () => {} },
	};
	const user = await createAdminUser({ db: { $transaction: (callback) => callback(tx) }, actorUserId: "actor", email: "COD@example.test", password: "password-12345", displayName: "COD", roles: ["cod"], staffNumber: "cod-1" });
	assert.equal(calls.user.email, "cod@example.test");
	assert.equal(calls.user.isActive, true);
	assert.equal(calls.user.approvalStatus, "APPROVED");
	assert.ok(calls.user.emailVerifiedAt instanceof Date);
	assert.deepEqual(calls.identifier, { userId, type: "STAFF_NUMBER", value: "COD-1" });
	assert.deepEqual(user.roles, ["cod"]);
});

test("approving an unverified staff account leaves it inactive until email verification", async () => {
	const calls = {};
	const pendingUser = {
		id: userId,
		email: "cod@example.test",
		displayName: "COD",
		isActive: false,
		approvalStatus: "PENDING",
		emailVerifiedAt: null,
		roles: [{ role: { name: "cod" } }],
		loginIdentifiers: [{ type: "STAFF_NUMBER", value: "COD-1" }],
		studentProfile: null,
		lecturerProfile: null,
	};
	const tx = {
		user: { findUnique: async () => pendingUser, update: async ({ data }) => { calls.userUpdate = data; }, findUniqueOrThrow: async () => null },
		role: { findMany: async () => [{ id: "cod-role", name: "cod" }] },
		userRole: { deleteMany: async () => {}, createMany: async () => {} },
		auditLog: { create: async () => {} },
	};
	const userSelectResult = { ...pendingUser, approvalStatus: "APPROVED", isActive: false };
	let userLookup = 0;
	tx.user.findUnique = async () => userLookup++ === 0 ? pendingUser : userSelectResult;
	const result = await decideStaffAccount({ db: { $transaction: (callback) => callback(tx) }, actorUserId: "actor", userId, status: "APPROVED" });
	assert.deepEqual(calls.userUpdate, { approvalStatus: "APPROVED", isActive: false });
	assert.equal(result.approvalStatus, "APPROVED");
	assert.equal(result.isActive, false);
});
