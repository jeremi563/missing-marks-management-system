import test from "node:test";
import assert from "node:assert/strict";
import { getAdminUser } from "../../src/modules/admin/admin.service.js";

const userId = "00000000-0000-4000-8000-000000000001";

test("administrator account detail returns effective access without secrets", async () => {
	const db = {
		user: { findUnique: async () => ({
			id: userId, email: "cod@example.test", displayName: "COD", isActive: true, createdAt: new Date(), updatedAt: new Date(),
			roles: [{ role: { name: "cod" } }], studentProfile: null, lecturerProfile: { id: "profile", staffNumber: "STAFF-1", _count: { unitAssignments: 2, assignedReports: 1, attendanceSessions: 3 } },
			departmentMemberships: [{ department: { id: "department", code: "CS", name: "Computing", designatedCodUserId: userId }, createdAt: new Date() }],
			_count: { auditLogs: 4, reportAssignments: 5, reportStatusChanges: 6 },
		}) },
	};
	const result = await getAdminUser({ db, userId });
	assert.deepEqual(result.roles, ["cod"]);
	assert.equal(result.departments[0].isDesignatedCod, true);
	assert.deepEqual(result.responsibilities, { auditEvents: 4, reportAssignments: 5, reportStatusChanges: 6, lecturer: { unitAssignments: 2, assignedReports: 1, attendanceSessions: 3 } });
	assert.equal("passwordHash" in result, false);
});

test("administrator account detail reports missing users", async () => {
	await assert.rejects(getAdminUser({ db: { user: { findUnique: async () => null } }, userId }), (error) => error.statusCode === 404);
});