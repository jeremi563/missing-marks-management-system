import test from "node:test";
import assert from "node:assert/strict";
import { updateAdminUser } from "../../src/modules/admin/admin.service.js";

const userId = "00000000-0000-4000-8000-000000000001";

function transactionDb({ roles = ["cod"], designatedDepartments = 0, lecturerCounts = { unitAssignments: 0, assignedReports: 0, attendanceSessions: 0 } } = {}) {
	const current = {
		id: userId,
		email: "cod@example.test",
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
