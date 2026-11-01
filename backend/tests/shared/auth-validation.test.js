import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema } from "../../src/modules/auth/auth.validation.js";

test("accepts a valid login payload and normalizes email whitespace", () => {
	assert.deepEqual(loginSchema.parse({ email: "  user@example.test ", password: "demo-password" }), {
		email: "user@example.test",
		password: "demo-password",
	});
});

test("rejects malformed or unexpected login fields", () => {
	assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ email: "user@example.test", password: "x", role: "admin" }).success, false);
});