import test from "node:test";
import assert from "node:assert/strict";
import { academicPeriodCreateBody, assessmentCreateBody, classroomCreateBody, courseUnitCreateBody, departmentMemberParams, enrollmentCreateBody } from "../../src/modules/admin/academic.validation.js";

const id = "00000000-0000-4000-8000-000000000001";

test("academic structure validators accept valid department relationships", () => {
	assert.equal(courseUnitCreateBody.safeParse({ departmentId: id, code: "CS101", name: "Computer Science" }).success, true);
	assert.equal(enrollmentCreateBody.safeParse({ studentProfileId: id, courseUnitId: id, academicPeriodId: id }).success, true);
});

test("academic period validation rejects an end before its start", () => {
	const result = academicPeriodCreateBody.safeParse({ name: "2026 Semester 1", startsAt: "2026-01-01T00:00:00Z", endsAt: "2025-12-31T00:00:00Z" });
	assert.equal(result.success, false);
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