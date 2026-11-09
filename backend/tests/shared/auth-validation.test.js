import test from "node:test";
import assert from "node:assert/strict";
import { emailBodySchema, loginSchema, passwordResetSchema, registerSchema, tokenBodySchema } from "../../src/modules/auth/auth.validation.js";

test("accepts the new login identifier and legacy email payloads", () => {
	assert.deepEqual(loginSchema.parse({ identifier: "  STU-001 ", password: "demo-password" }), {
		identifier: "STU-001",
		password: "demo-password",
	});
	assert.deepEqual(loginSchema.parse({ email: "  user@example.test ", password: "demo-password" }), {
		email: "user@example.test",
		password: "demo-password",
	});
});

test("rejects malformed or unexpected login fields", () => {
	assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "ID-1", email: "user@example.test", password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ email: "user@example.test", password: "x", role: "admin" }).success, false);
});

test("validates student and staff registration identifiers by role", () => {
	assert.equal(registerSchema.safeParse({ role: "student", email: "s@example.test", password: "password-12345", studentNumber: "STU-1" }).success, true);
	assert.equal(registerSchema.safeParse({ role: "lecturer", email: "l@example.test", password: "password-12345", staffNumber: "LECT-1" }).success, true);
	assert.equal(registerSchema.safeParse({ role: "cod", email: "c@example.test", password: "password-12345", staffNumber: "COD-1" }).success, true);
	assert.equal(registerSchema.safeParse({ role: "student", email: "s@example.test", password: "password-12345", staffNumber: "STAFF-1" }).success, false);
	assert.equal(registerSchema.safeParse({ role: "administrator", email: "a@example.test", password: "password-12345", staffNumber: "ADM-1" }).success, false);
});

test("validates recovery tokens and reset passwords", () => {
	const token = "x".repeat(43);
	assert.equal(tokenBodySchema.safeParse({ token }).success, true);
	assert.equal(passwordResetSchema.safeParse({ token, password: "password-12345" }).success, true);
	assert.equal(passwordResetSchema.safeParse({ token, password: "short" }).success, false);
	assert.equal(emailBodySchema.safeParse({ email: "invalid" }).success, false);
});