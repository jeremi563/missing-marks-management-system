import test from "node:test";
import assert from "node:assert/strict";
import {
	invigilatorBookletPreviewBody,
	invigilatorBookletScanBody,
	manualBookletLookupBody,
	replaceBookletBody,
	studentBookletScanBody,
} from "../../src/modules/exam-booklet/exam-booklet.validation.js";

const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const token = "a".repeat(64);

test("student scans require a valid session and opaque QR token without client identity fields", () => {
	assert.equal(studentBookletScanBody.safeParse({ sessionId, token }).success, true);
	assert.equal(studentBookletScanBody.safeParse({ sessionId, token, studentProfileId: sessionId }).success, false);
	assert.equal(studentBookletScanBody.safeParse({ sessionId, token: "student-number" }).success, false);
});

test("invigilator preview and final scan require QR token and explicit identity confirmation", () => {
	assert.equal(invigilatorBookletPreviewBody.safeParse({ token }).success, true);
	assert.equal(invigilatorBookletScanBody.safeParse({ token, identityConfirmed: true }).success, true);
	assert.equal(invigilatorBookletScanBody.safeParse({ token, identityConfirmed: false }).success, false);
	assert.equal(invigilatorBookletScanBody.safeParse({ token, identityConfirmed: true, studentProfileId: sessionId }).success, false);
});

test("manual lookup requires a student number and explicit confirmation; replacement requires a reason", () => {
	assert.equal(manualBookletLookupBody.safeParse({ studentNumber: "IN16/01234/26", identityConfirmed: true }).success, true);
	assert.equal(manualBookletLookupBody.safeParse({ studentNumber: "IN16/01234/26", identityConfirmed: false }).success, false);
	assert.equal(replaceBookletBody.safeParse({ reason: "QR is damaged" }).success, true);
	assert.equal(replaceBookletBody.safeParse({ reason: "  " }).success, false);
});
