import test from "node:test";
import assert from "node:assert/strict";
import { addWorkingDays, BUSINESS_TIME_ZONE, isOverdue, isWorkingDay, localDateKeyForNairobi } from "../../src/shared/utils/business-days.js";

test("adds seven working days and preserves the Nairobi clock time", () => {
	assert.equal(BUSINESS_TIME_ZONE, "Africa/Nairobi");
	assert.equal(addWorkingDays(new Date("2026-02-02T07:35:41.123Z"), 7).toISOString(), "2026-02-11T07:35:41.123Z");
});

test("counts from the next eligible day after a Friday or weekend start", () => {
	assert.equal(addWorkingDays(new Date("2026-10-30T07:00:00Z"), 7).toISOString(), "2026-11-10T07:00:00.000Z");
	assert.equal(addWorkingDays(new Date("2026-10-31T07:00:00Z"), 7).toISOString(), "2026-11-10T07:00:00.000Z");
});

test("skips consecutive Kenyan public holidays and holidays falling on weekends", () => {
	const holidays = ["2026-03-03", "2026-03-04", "2026-03-07"];
	assert.equal(addWorkingDays(new Date("2026-03-02T06:15:00Z"), 7, holidays).toISOString(), "2026-03-13T06:15:00.000Z");
	assert.equal(isWorkingDay(new Date("2026-03-07T09:00:00Z"), holidays), false);
});

test("handles year transitions and maps local Nairobi dates", () => {
	assert.equal(addWorkingDays(new Date("2026-12-29T06:00:00Z"), 3, ["2027-01-01"]).toISOString(), "2027-01-04T06:00:00.000Z");
	assert.equal(localDateKeyForNairobi(new Date("2026-12-31T22:30:00Z")), "2027-01-01");
});

test("a decision exactly at the stored deadline is on time", () => {
	const deadline = new Date("2026-07-10T07:00:00.000Z");
	assert.equal(isOverdue(deadline, deadline), false);
	assert.equal(isOverdue(deadline, new Date(deadline.valueOf() + 1)), true);
});
