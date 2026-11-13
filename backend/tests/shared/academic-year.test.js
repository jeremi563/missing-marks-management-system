import test from "node:test";
import assert from "node:assert/strict";
import { academicYearForDate, academicYearForPeriod } from "../../src/shared/utils/academic-year.js";

test("academic years start in August", () => {
	assert.equal(academicYearForDate(new Date("2026-07-31T23:59:59Z")), "2025/26");
	assert.equal(academicYearForDate(new Date("2026-08-01T00:00:00Z")), "2026/27");
	assert.equal(academicYearForDate(new Date("2026-11-13T00:00:00Z")), "2026/27");
	assert.equal(academicYearForPeriod({ startsAt: new Date("2026-08-31T00:00:00Z") }), "2026/27");
});

test("academic periods without dates use the year encoded in their name or code", () => {
	assert.equal(academicYearForPeriod({ name: "Semester 1 2026/27" }), "2026/27");
	assert.equal(academicYearForPeriod({ name: "Semester 1", code: "2026" }), "2026/27");
	assert.equal(academicYearForPeriod({ name: "Semester 1" }), null);
});
