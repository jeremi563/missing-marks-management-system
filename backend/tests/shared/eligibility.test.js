import test from "node:test";
import assert from "node:assert/strict";
import { calculateAttendancePercentage, evaluateAttendanceEligibility } from "../../src/shared/services/eligibility.service.js";

test("calculates attendance percentage to two decimal places", () => {
	assert.equal(calculateAttendancePercentage(7, 9), 77.78);
});

test("uses the configured threshold without embedding an institutional rule", () => {
	assert.deepEqual(evaluateAttendanceEligibility({ attendedSessions: 4, applicableSessions: 5, minimumPercentage: 80 }), {
		percentage: 80,
		meetsRequirement: true,
	});
	assert.equal(evaluateAttendanceEligibility({ attendedSessions: 3, applicableSessions: 5, minimumPercentage: 80 }).meetsRequirement, false);
});

test("rejects invalid counts and zero applicable sessions", () => {
	assert.throws(() => calculateAttendancePercentage(1, 0), RangeError);
	assert.throws(() => calculateAttendancePercentage(3, 2), RangeError);
	assert.throws(() => evaluateAttendanceEligibility({ attendedSessions: 1, applicableSessions: 2, minimumPercentage: 101 }), RangeError);
});