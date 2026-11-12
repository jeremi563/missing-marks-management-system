import test from "node:test";
import assert from "node:assert/strict";
import { createAdminUser, decideDepartmentLecturerAccount, decideStaffAccount, listAdminUsers, listPendingDepartmentLecturers, updateAdminUser } from "../../src/modules/admin/admin.service.js";

const userId = "00000000-0000-4000-8000-000000000001";

test("admin user listing filters by staff approval status", async () => {
	const queries = [];
	const db = {
		user: {
			findMany: async ({ where }) => { queries.push(where); return []; },
			count: async ({ where }) => { queries.push(where); return 0; },
		},
	};
	await listAdminUsers({ db, role: "lecturer", approvalStatus: "APPROVED" });
	assert.deepEqual(queries, [
		{ roles: { some: { role: { name: "lecturer" } } }, approvalStatus: "APPROVED" },
		{ roles: { some: { role: { name: "lecturer" } } }, approvalStatus: "APPROVED" },
	]);
});

test("default account listing places administrator accounts before other roles", async () => {
	const accounts = [
		{ id: "staff", displayName: "A Staff", email: "staff@example.test", roles: [{ role: { name: "lecturer" } }] },
		{ id: "admin", displayName: "Z Admin", email: "admin@example.test", roles: [{ role: { name: "administrator" } }] },
	];
	const db = {
		user: {
			findMany: async ({ where }) => where.roles ? accounts.filter(({ id }) => id === "admin") : accounts.filter(({ id }) => id !== "admin"),
			count: async ({ where }) => where.roles ? 1 : 2,
		},
	};
	const result = await listAdminUsers({ db, page: 1, limit: 2 });
	assert.deepEqual(result.users.map(({ id }) => id), ["admin", "staff"]);
});

function transactionDb({ roles = ["cod"], designatedDepartments = 0, lecturerCounts = { unitAssignments: 0, assignedReports: 0, attendanceSessions: 0 }, approvalStatus = "APPROVED", emailVerifiedAt = new Date() } = {}) {
	const current = {
		id: userId,
		displayName: "Staff",
		isActive: true,
		approvalStatus,
		emailVerifiedAt,
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

test("administrator cannot activate a lecturer before staff approval", async () => {
	await assert.rejects(
		updateAdminUser({ db: transactionDb({ roles: ["lecturer"], approvalStatus: "PENDING" }), actorUserId: "actor", userId, isActive: true }),
		(error) => error.statusCode === 409 && /Lecturer approvals/.test(error.message),
	);
});

test("administrator cannot deactivate their own account", async () => {
	await assert.rejects(
		updateAdminUser({
			db: transactionDb({ roles: ["administrator"] }),
			actorUserId: userId,
			userId,
			isActive: false,
		}),
		(error) => error.statusCode === 409 && /cannot deactivate their own account/i.test(error.message),
	);
});

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

test("administrator email updates are verified immediately and invalidate pending change links", async () => {
	const current = {
		id: userId,
		email: "old-admin@example.test",
		displayName: "Admin",
		isActive: true,
		approvalStatus: "APPROVED",
		emailVerifiedAt: null,
		roles: [{ role: { name: "administrator" } }],
		loginIdentifiers: [{ type: "ADMIN_NUMBER", value: `admin/12/${new Date().getFullYear()}` }],
		studentProfile: null,
		lecturerProfile: null,
	};
	const calls = {};
	let userLookup = 0;
	const updated = { ...current, email: "new-admin@example.test", emailVerifiedAt: new Date() };
	const tx = {
		user: {
			findUnique: async ({ where }) => {
				if (where.id) return userLookup++ === 0 ? current : updated;
				return null;
			},
			update: async ({ data }) => { calls.userUpdate = data; return { id: userId }; },
		},
		accountSecurityToken: { updateMany: async (args) => { calls.tokenUpdate = args; } },
		auditLog: { create: async () => {} },
	};
	await updateAdminUser({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "actor",
		userId,
		email: "New-Admin@Example.Test",
	});

	assert.equal(calls.userUpdate.email, "new-admin@example.test");
	assert.equal(calls.userUpdate.pendingEmail, null);
	assert.ok(calls.userUpdate.emailVerifiedAt instanceof Date);
	assert.deepEqual(calls.tokenUpdate.where, { userId, type: { in: ["EMAIL_CHANGE", "EMAIL_VERIFICATION"] }, usedAt: null });
});

test("administrator can create a COD account with both staff roles and a staff identifier", async () => {
	const calls = {};
	const createdUser = {
		id: userId,
		email: "cod@example.test",
		displayName: "COD",
		isActive: true,
		approvalStatus: "APPROVED",
		emailVerifiedAt: new Date(),
		roles: [{ role: { name: "lecturer" } }, { role: { name: "cod" } }],
		loginIdentifiers: [{ type: "STAFF_NUMBER", value: "AB/0123/COD1" }],
		studentProfile: null,
		lecturerProfile: { id: "lecturer-profile", staffNumber: "AB/0123/COD1" },
	};
	const tx = {
		role: {
			findMany: async () => [{ id: "lecturer-role", name: "lecturer" }],
			upsert: async ({ where }) => ({ id: "cod-role", name: where.name }),
		},
		user: {
			create: async ({ data }) => { calls.user = data; return { id: userId }; },
			findUnique: async () => createdUser,
		},
		userRole: { createMany: async ({ data }) => { calls.roles = data; } },
		lecturerProfile: { create: async ({ data }) => { calls.lecturerProfile = data; } },
		accountLoginIdentifier: {
			findFirst: async () => null,
			create: async ({ data }) => { calls.loginIdentifier = data; },
		},
		auditLog: { create: async ({ data }) => { calls.audit = data; } },
	};
	const result = await createAdminUser({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "actor",
		email: "cod@example.test",
		password: "password-12345",
		displayName: "COD",
		roles: ["cod"],
		staffNumber: "AB/0123/COD1",
	});

	assert.deepEqual(result.roles, ["lecturer", "cod"]);
	assert.deepEqual(calls.roles, [{ userId, roleId: "cod-role" }, { userId, roleId: "lecturer-role" }]);
	assert.deepEqual(calls.lecturerProfile, { userId, staffNumber: "AB/0123/COD1" });
	assert.deepEqual(calls.loginIdentifier, { userId, type: "STAFF_NUMBER", value: "AB/0123/COD1" });
});

test("administrator can promote only an active approved lecturer to COD and keeps lecturer role", async () => {
	const calls = {};
	const current = {
		id: userId,
		email: "lecturer@example.test",
		displayName: "Lecturer",
		isActive: true,
		approvalStatus: "APPROVED",
		roles: [{ role: { name: "lecturer" } }],
		loginIdentifiers: [{ type: "STAFF_NUMBER", value: "AB/0123/STAFF9" }],
		studentProfile: null,
		lecturerProfile: { id: "lecturer-profile", staffNumber: "AB/0123/STAFF9" },
	};
	const updated = { ...current, roles: [{ role: { name: "lecturer" } }, { role: { name: "cod" } }] };
	let lookupCount = 0;
	const tx = {
		user: {
			findUnique: async () => lookupCount++ === 0 ? current : updated,
			update: async ({ data }) => { calls.userUpdate = data; return { id: userId }; },
		},
		role: {
			findMany: async () => [{ id: "lecturer-role", name: "lecturer" }],
			upsert: async ({ where, create }) => {
				assert.equal(where.name, "cod");
				return { id: "cod-role", ...create };
			},
		},
		userRole: {
			deleteMany: async () => {},
			createMany: async ({ data }) => { calls.roles = data; },
		},
		accountLoginIdentifier: {
			findFirst: async () => ({ id: "staff-identifier" }),
			update: async ({ data }) => { calls.identifier = data; },
		},
		department: { findUnique: async () => ({ id: "department-id", designatedCodUserId: null }), count: async () => 0, update: async ({ data }) => { calls.departmentUpdate = data; return { id: "department-id" }; } },
		departmentMembership: { findUnique: async () => null, create: async ({ data }) => { calls.departmentMembership = data; return { id: "department-membership" }; } },
		lecturerProfile: { findUnique: async () => null },
		auditLog: { create: async () => {} },
	};

	const result = await updateAdminUser({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "actor",
		userId,
		roles: ["lecturer", "cod"],
		departmentId: "department-id",
	});

	assert.deepEqual(calls.roles, [{ userId, roleId: "lecturer-role" }, { userId, roleId: "cod-role" }]);
	assert.deepEqual(result.roles, ["lecturer", "cod"]);
	assert.equal(calls.identifier.value, "AB/0123/STAFF9");
	assert.deepEqual(calls.departmentMembership, { userId, departmentId: "department-id" });
	assert.deepEqual(calls.departmentUpdate, { designatedCodUserId: userId });
});

test("administrator must choose a department when assigning COD responsibility", async () => {
	await assert.rejects(
		updateAdminUser({
			db: transactionDb({ roles: ["lecturer"] }),
			actorUserId: "actor",
			userId,
			roles: ["lecturer", "cod"],
		}),
		(error) => error.statusCode === 422 && /Select a department/.test(error.message),
	);
});

test("administrator cannot promote a student to COD", async () => {
	await assert.rejects(
		updateAdminUser({
			db: transactionDb({ roles: ["student"] }),
			actorUserId: "actor",
			userId,
			roles: ["lecturer", "cod"],
		}),
		(error) => error.statusCode === 422,
	);
});

function pendingLecturer(overrides = {}) {
	return {
		id: userId,
		email: "lecturer@example.test",
		displayName: "Lecturer",
		isActive: false,
		approvalStatus: "PENDING",
		emailVerifiedAt: null,
		roles: [{ role: { name: "lecturer" } }],
		loginIdentifiers: [{ type: "STAFF_NUMBER", value: "AB/0123/STAFF9" }],
		studentProfile: null,
		lecturerProfile: { id: "lecturer-profile", staffNumber: "AB/0123/STAFF9" },
		departmentMemberships: [{ department: { id: "department-id", name: "Computing", designatedCodUserId: "cod-user" } }],
		...overrides,
	};
}

test("approving a department-registered lecturer activates the account without email verification", async () => {
	const calls = [];
	const user = pendingLecturer();
	const pendingUser = {
		...user,
		approvalStatus: "APPROVED",
		isActive: true,
	};
	const tx = {
		user: {
			findUnique: async () => calls.some(([operation]) => operation === "user.update") ? pendingUser : user,
			update: async ({ data }) => { calls.push(["user.update", data]); },
		},
		auditLog: { create: async ({ data }) => calls.push(["auditLog.create", data]) },
	};
	const result = await decideStaffAccount({ db: { $transaction: (callback) => callback(tx) }, actorUserId: "admin", userId, status: "APPROVED" });
	assert.deepEqual(calls[0], ["user.update", { approvalStatus: "APPROVED", isActive: true }]);
	assert.equal(calls[1][1].actorId, "admin");
	assert.deepEqual(calls[1][1].metadata.roles, ["lecturer"]);
	assert.equal(result.approvalStatus, "APPROVED");
	assert.equal(result.isActive, true);
});

test("staff approval requires completed department registration", async () => {
	const user = pendingLecturer({ departmentMemberships: [] });
	await assert.rejects(
		decideStaffAccount({
			db: { $transaction: (callback) => callback({ user: { findUnique: async () => user } }) },
			actorUserId: "actor",
			userId,
			status: "APPROVED",
		}),
		(error) => error.statusCode === 409 && /department registration/i.test(error.message),
	);
});

test("rejecting a staff application deletes its account and registration data", async () => {
	const calls = [];
	const pendingUser = pendingLecturer({ displayName: "Lecturer Applicant" });
	const tx = {
		user: { findUnique: async () => pendingUser, delete: async ({ where }) => calls.push(["user.delete", where]) },
		lecturerProfile: { deleteMany: async ({ where }) => calls.push(["lecturerProfile.deleteMany", where]) },
		auditLog: { create: async ({ data }) => calls.push(["auditLog.create", data]) },
	};

	const result = await decideStaffAccount({ db: { $transaction: (callback) => callback(tx) }, actorUserId: "admin", userId, status: "REJECTED" });

	assert.deepEqual(result, { id: userId, approvalStatus: "REJECTED", deleted: true });
	assert.deepEqual(calls.map(([operation]) => operation), ["lecturerProfile.deleteMany", "auditLog.create", "user.delete"]);
	assert.deepEqual(calls[0][1], { userId });
	assert.equal(calls[1][1].actorId, "admin");
	assert.equal(calls[1][1].metadata.accountDeleted, true);
	assert.deepEqual(calls[2][1], { id: userId });
});

test("COD approval queue only requests lecturer accounts assigned to that COD's department", async () => {
	let query;
	const user = pendingLecturer();
	const result = await listPendingDepartmentLecturers({
		userId: "cod-user",
		db: { user: { findMany: async (args) => { query = args; return [user]; } } },
	});
	assert.deepEqual(query.where.departmentMemberships, { some: { department: { designatedCodUserId: "cod-user" } } });
	assert.equal(result[0].departmentMemberships[0].department.name, "Computing");
});

test("designated COD can approve a lecturer in their own department", async () => {
	const calls = [];
	const user = pendingLecturer();
	const approved = { ...user, approvalStatus: "APPROVED", isActive: true };
	const tx = {
		user: {
			findUnique: async () => calls.some(([operation]) => operation === "user.update") ? approved : user,
			findFirst: async ({ where }) => where.id === "cod-user" ? { id: "cod-user" } : null,
			update: async ({ data }) => calls.push(["user.update", data]),
		},
		auditLog: { create: async ({ data }) => calls.push(["auditLog.create", data]) },
	};
	const result = await decideDepartmentLecturerAccount({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "cod-user",
		userId,
		status: "APPROVED",
	});
	assert.equal(result.approvalStatus, "APPROVED");
	assert.equal(calls[1][1].actorId, "cod-user");
});

test("COD cannot approve a lecturer assigned to another department's COD", async () => {
	const user = pendingLecturer({
		departmentMemberships: [{ department: { id: "department-id", name: "Computing", designatedCodUserId: "other-cod" } }],
	});
	let updateCalled = false;
	const tx = {
		user: {
			findUnique: async () => user,
			findFirst: async () => ({ id: "cod-user" }),
			update: async () => { updateCalled = true; },
		},
	};
	await assert.rejects(decideDepartmentLecturerAccount({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "cod-user",
		userId,
		status: "APPROVED",
	}), { statusCode: 403 });
	assert.equal(updateCalled, false);
});
