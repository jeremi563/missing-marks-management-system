import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardOverview } from "../../src/modules/admin/operations.service.js";

function count(value) {
	return { count: async () => value };
}

test("dashboard overview returns aggregate counts and report status totals", async () => {
	const db = {
		user: count(10),
		studentProfile: count(4),
		lecturerProfile: count(3),
		department: count(2),
		courseUnit: count(8),
		academicPeriod: count(3),
		unitEnrollment: count(40),
		courseUnitLecturer: count(9),
		classroom: count(5),
		assessment: count(12),
		missingMarkReport: { count: async () => 7, groupBy: async () => [{ status: "PENDING", _count: { _all: 5 } }, { status: "REJECTED", _count: { _all: 2 } }] },
	};
	db.user.count = async ({ where } = {}) => where?.isActive ? 8 : 10;
	const result = await getDashboardOverview({ db });
	assert.deepEqual(result.users, { active: 8, total: 10, inactive: 2, activeStudents: 4, activeLecturers: 3 });
	assert.equal(result.academic.activeClassrooms, 5);
	assert.deepEqual(result.reports, { total: 7, byStatus: [{ status: "PENDING", count: 5 }, { status: "REJECTED", count: 2 }] });
	assert.ok(result.generatedAt instanceof Date);
});