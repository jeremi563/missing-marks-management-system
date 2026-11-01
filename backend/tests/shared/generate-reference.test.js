import test from "node:test";
import assert from "node:assert/strict";
import { generateReference } from "../../src/shared/utils/generate-reference.js";

test("creates a year-prefixed missing-mark reference", () => {
	assert.match(generateReference(new Date("2026-04-03T00:00:00.000Z")), /^MM-2026-[A-F0-9]{10}$/);
});

test("generates distinct references for separate reports", () => {
	assert.notEqual(generateReference(), generateReference());
});