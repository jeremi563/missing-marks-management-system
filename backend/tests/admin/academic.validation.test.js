import test from "node:test";
import assert from "node:assert/strict";
import { academicPeriodCreateBody, assessmentCreateBody, classroomCreateBody, courseCreateBody, courseUnitCreateBody, departmentCreateBody, departmentMemberParams, departmentUpdateBody } from "../../src/modules/admin/academic.validation.js";
import { reopenReportBody, reassignReportBody } from "../../src/modules/admin/operations.validation.js";

const id = "00000000-0000-4000-8000-000000000001";

test("academic structure validators accept valid department relationships", () => {
	assert.equal(courseCreateBody.safeParse({ departmentId: id, code: "16", name: "BSc Computing" }).success, true);
	assert.equal(courseCreateBody.safeParse({ departmentId: id, code: "160", name: "BSc Computing" }).success, false);
	assert.equal(courseUnitCreateBody.safeParse({ courseId: id, code: "CS101", name: "Computer Science" }).success, true);
	assert.equal(departmentCreateBody.safeParse({ name: "Computing", initials: "IN" }).success, true);
	assert.equal(departmentCreateBody.safeParse({ name: "Computing", initials: "in" }).success, false);
	assert.equal(departmentCreateBody.safeParse({ name: "Computing", initials: "C" }).success, false);
	assert.equal(departmentUpdateBody.safeParse({ initials: "IN" }).success, true);
	assert.equal(departmentUpdateBody.safeParse({ code: "COMP" }).success, true);
	assert.equal(departmentUpdateBody.safeParse({ code: "" }).success, false);
	assert.equal(departmentUpdateBody.safeParse({ code: null }).success, true);
	assert.equal(departmentUpdateBody.safeParse({ name: "Computing", initials: "IN", code: "COMP" }).success, true);
});

test("academic period validation enforces academic and enrollment-window date pairs", () => {
	const result = academicPeriodCreateBody.safeParse({ name: "2026 Semester 1", startsAt: "2026-01-01T00:00:00Z", endsAt: "2025-12-31T00:00:00Z" });
	assert.equal(result.success, false);
	assert.equal(academicPeriodCreateBody.safeParse({
		name: "2026/27",
		enrollmentOpensAt: "2026-09-01T00:00:00Z",
		enrollmentClosesAt: "2026-10-01T23:59:59Z",
	}).success, true);
	assert.equal(academicPeriodCreateBody.safeParse({
		name: "2026/27",
		enrollmentOpensAt: "2026-10-01T00:00:00Z",
		enrollmentClosesAt: "2026-09-01T23:59:59Z",
	}).success, false);
	assert.equal(academicPeriodCreateBody.safeParse({
		name: "2026/27",
		enrollmentOpensAt: "2026-09-01T00:00:00Z",
	}).success, false);
});

test("classroom validation enforces coordinate and boundary ranges", () => {
	assert.equal(classroomCreateBody.safeParse({ name: "Room 1", latitude: 1.2, longitude: 36.8, boundaryMeters: 100 }).success, true);
	assert.equal(classroomCreateBody.safeParse({ name: "Room 1", latitude: 91, longitude: 36.8, boundaryMeters: 100 }).success, false);
});

test("assessment validation accepts optional flags and rejects invalid marks", () => {
	assert.equal(assessmentCreateBody.safeParse({ courseUnitId: id, name: "CAT 1", type: "CAT", maximumMarks: 30, attendanceRequired: true }).success, true);
	assert.equal(assessmentCreateBody.safeParse({ courseUnitId: id, name: "CAT 1", type: "CAT", maximumMarks: -1 }).success, false);
});

test("department membership validation requires both department and user UUIDs", () => {
	assert.equal(departmentMemberParams.safeParse({ departmentId: id, userId: id }).success, true);
	assert.equal(departmentMemberParams.safeParse({ departmentId: id }).success, false);
});

test("maintenance validation requires a reason and a target lecturer", () => {
	assert.equal(reopenReportBody.safeParse({ reason: "Policy-approved correction" }).success, true);
	assert.equal(reassignReportBody.safeParse({ lecturerProfileId: id, reason: "Workload reassignment" }).success, true);
	assert.equal(reopenReportBody.safeParse({ reason: "" }).success, false);
});