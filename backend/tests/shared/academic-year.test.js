import test from "node:test";
import assert from "node:assert/strict";
import { academicYearBounds, academicYearForDate, academicYearForPeriod } from "../../src/shared/utils/academic-year.js";

test("academic years use Nairobi September-to-August boundaries", () => {
	assert.equal(academicYearForDate(new Date("2026-08-31T20:59:59.999Z")), "2025/26");
	assert.equal(academicYearForDate(new Date("2026-08-31T21:00:00.000Z")), "2026/27");
	assert.equal(academicYearForDate(new Date("2027-08-31T20:59:59.999Z")), "2026/27");
	assert.equal(academicYearForDate(new Date("2027-08-31T21:00:00.000Z")), "2027/28");
	assert.equal(academicYearForDate("2026-09-01T00:00:00+03:00"), "2026/27");
	assert.equal(academicYearForDate("invalid"), null);
});

test("academic periods derive their year only from startsAt", () => {
	assert.equal(academicYearForPeriod({ startsAt: new Date("2026-09-01T00:00:00Z"), name: "2019/20" }), "2026/27");
	assert.equal(academicYearForPeriod({ name: "Semester 1 2026/27", code: "2026" }), null);
	assert.equal(academicYearForPeriod({ name: "Semester 1" }), null);
});

test("academic-year bounds are Nairobi midnight and use an exclusive next-year boundary", () => {
	const bounds = academicYearBounds("2026/27");
	assert.equal(bounds.startsAt.toISOString(), "2026-08-31T21:00:00.000Z");
	assert.equal(bounds.endsAt.toISOString(), "2027-08-31T21:00:00.000Z");
	assert.equal(academicYearBounds("2026/28"), null);
});
