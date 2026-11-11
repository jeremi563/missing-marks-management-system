import test from "node:test";
import assert from "node:assert/strict";
import { emailBodySchema, lecturerDepartmentRegistrationSchema, loginSchema, passwordChangeSchema, passwordResetSchema, registerSchema, tokenBodySchema } from "../../src/modules/auth/auth.validation.js";

test("accepts registration number and password login", () => {
	assert.deepEqual(loginSchema.parse({ identifier: "  AB/01243/2026 ", password: "demo-password" }), {
		identifier: "AB/01243/2026",
		password: "demo-password",
	});
});

test("rejects malformed or unexpected login fields", () => {
	assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "AB/01243/2026", email: "user@example.test", password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "AB/01243/2026", password: "x", role: "admin" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "x".repeat(101), password: "x" }).success, false);
});

test("validates registration details without a client-selected account type", () => {
	const year = new Date().getFullYear();
	const base = { email: "s@example.test", password: "12345678", displayName: "Student Name" };
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: `AB/01243/${year}` }).success, true);
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: "AB/0123/STAFF9" }).success, true);
	assert.equal(registerSchema.safeParse({ ...base, password: "1234567", registrationNumber: `AB/01243/${year}` }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: `AB/01243/${year + 1}` }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: "admin/12/2020" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: "STU-1" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, role: "student", registrationNumber: `AB/01243/${year}` }).success, false);
});

test("validates the second-step lecturer department registration", () => {
	const registration = {
		email: "lecturer@example.test",
		password: "12345678",
		displayName: "Lecturer",
		registrationNumber: "AB/0123/STAFF9",
		departmentId: "00000000-0000-4000-8000-000000000001",
	};
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse(registration).success, true);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, departmentId: "invalid" }).success, false);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, registrationNumber: "AB/01243/2026" }).success, false);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, extra: true }).success, false);
});

test("validates recovery tokens and reset passwords", () => {
	const token = "x".repeat(43);
	assert.equal(tokenBodySchema.safeParse({ token }).success, true);
	assert.equal(passwordResetSchema.safeParse({ token, password: "12345678" }).success, true);
	assert.equal(passwordResetSchema.safeParse({ token, password: "1234567" }).success, false);
	assert.equal(passwordResetSchema.safeParse({ token, password: "short" }).success, false);
	assert.equal(emailBodySchema.safeParse({ email: "invalid" }).success, false);
});

test("validates authenticated password changes", () => {
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-password", newPassword: "12345678" }).success, true);
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "", newPassword: "12345678" }).success, false);
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-password", newPassword: "1234567" }).success, false);
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-password", newPassword: "12345678", unexpected: true }).success, false);
});