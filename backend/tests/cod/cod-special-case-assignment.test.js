import test from "node:test";
import assert from "node:assert/strict";
import { assignCodCourseUnitLecturer } from "../../src/modules/cod/cod.service.js";

test("assigning a lecturer notifies them of cases previously waiting for assignment resolution", async () => {
	const notifications = [];
	const audits = [];
	const mapping = {
		id: "assignment-1",
		courseUnitId: "unit-1",
		lecturerProfileId: "lecturer-profile-1",
		isActive: true,
		lecturer: { user: { id: "lecturer-user-1", displayName: "Lecturer", email: "lecturer@example.edu" } },
	};
	const tx = {
		courseUnit: { findFirst: async () => ({ id: "unit-1", course: { id: "course-1" } }) },
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-profile-1" }) },
		courseUnitLecturer: {
			findFirst: async () => null,
			create: async () => mapping,
		},
		specialCase: { findMany: async () => [{ id: "case-1" }] },
		notificationOutbox: { create: async ({ data }) => { notifications.push(data); return data; } },
		auditLog: { create: async ({ data }) => { audits.push(data); return data; } },
	};
	const db = {
		departmentMembership: { findMany: async () => [{ departmentId: "department-1" }] },
		user: { findFirst: async () => ({ id: "cod-user-1" }) },
		department: { findMany: async () => [{ id: "department-1" }] },
		$transaction: async (callback) => callback(tx),
	};
	const result = await assignCodCourseUnitLecturer({
		db,
		userId: "cod-user-1",
		courseUnitId: "unit-1",
		departmentId: "department-1",
		lecturerProfileId: "lecturer-profile-1",
		now: new Date("2026-03-01T10:00:00.000Z"),
	});

	assert.equal(result.id, "assignment-1");
	assert.equal(audits[0].action, "COD_COURSE_UNIT_LECTURER_ASSIGNED");
	assert.equal(notifications.length, 1);
	assert.equal(notifications[0].recipientUserId, "lecturer-user-1");
	assert.equal(notifications[0].eventType, "SPECIAL_CASE_REVIEW_REQUIRED");
});
