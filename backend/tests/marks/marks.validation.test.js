import test from "node:test";
import assert from "node:assert/strict";

const {
	correctionDecisionBody,
	submitMarksBody,
} = await import("../../src/modules/marks/marks.validation.js");

const validId = "550e8400-e29b-41d4-a716-446655440000";

test("initial mark validation rejects duplicate students and excess precision", () => {
	assert.equal(submitMarksBody.safeParse({
		academicPeriodId: validId,
		marks: [
			{ studentProfileId: validId, value: 10 },
			{ studentProfileId: validId, value: 20 },
		],
	}).success, false);
	assert.equal(submitMarksBody.safeParse({
		academicPeriodId: validId,
		marks: [{ studentProfileId: validId, value: 1.234 }],
	}).success, false);
});

test("correction rejection requires a reason while approval comments remain optional", () => {
	assert.equal(correctionDecisionBody.safeParse({ decision: "REJECT" }).success, false);
	assert.equal(correctionDecisionBody.safeParse({ decision: "REJECT", comments: "Not supported." }).success, true);
	assert.equal(correctionDecisionBody.safeParse({ decision: "APPROVE" }).success, true);
});
