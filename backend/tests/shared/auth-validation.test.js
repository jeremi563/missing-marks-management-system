import test from "node:test";
import assert from "node:assert/strict";
import { emailBodySchema, lecturerDepartmentRegistrationSchema, loginSchema, passwordChangeSchema, passwordResetSchema, registerSchema, tokenBodySchema } from "../../src/modules/auth/auth.validation.js";

test("accepts registration number, password, and account type for login", () => {
	assert.deepEqual(loginSchema.parse({ identifier: "  IN16/01243/26 ", password: "demo-password", accountType: "student" }), {
		identifier: "IN16/01243/26",
		password: "demo-password",
		accountType: "student",
	});
});

test("rejects malformed or unexpected login fields", () => {
	assert.equal(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "IN16/01243/26", email: "user@example.test", password: "x", accountType: "student" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "IN16/01243/26", password: "x", accountType: "admin" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "IN16/01243/26", password: "x" }).success, false);
	assert.equal(loginSchema.safeParse({ identifier: "x".repeat(101), password: "x" }).success, false);
});

test("validates registration details without a client-selected account type", () => {
	const year = new Date().getFullYear();
	const base = { email: "s@example.test", password: "Password1!", displayName: "Student Name" };
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: "AB/0123/STAFF9" }).success, true);
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: "AB16/01243/26" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, password: "1234567", registrationNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, password: "Password123", registrationNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, password: "Password!", registrationNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, password: "12345678!", registrationNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, password: `Password1!${"A".repeat(120)}`, registrationNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: "admin/12/2020" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, registrationNumber: "STU-1" }).success, false);
	assert.equal(registerSchema.safeParse({ ...base, role: "student", registrationNumber: `AB16/01243/${year}` }).success, false);
});

test("validates the second-step lecturer department registration", () => {
	const registration = {
		email: "lecturer@example.test",
		password: "12345678",
		displayName: "Lecturer",
		registrationNumber: "AB/0123/STAFF9",
		departmentIds: ["00000000-0000-4000-8000-000000000001"],
		primaryDepartmentId: "00000000-0000-4000-8000-000000000001",
	};
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse(registration).success, true);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, departmentIds: ["invalid"] }).success, false);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, primaryDepartmentId: "00000000-0000-4000-8000-000000000002" }).success, false);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, departmentIds: [registration.departmentIds[0], registration.departmentIds[0]] }).success, false);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, registrationNumber: "AB/01243/2026" }).success, false);
	assert.equal(lecturerDepartmentRegistrationSchema.safeParse({ ...registration, extra: true }).success, false);
});

test("validates recovery tokens and reset passwords", () => {
	const token = "x".repeat(43);
	assert.equal(tokenBodySchema.safeParse({ token }).success, true);
	assert.equal(passwordResetSchema.safeParse({ token, password: "Password1!" }).success, true);
	assert.equal(passwordResetSchema.safeParse({ token, password: "1234567" }).success, false);
	assert.equal(passwordResetSchema.safeParse({ token, password: "Password1" }).success, false);
	assert.equal(emailBodySchema.safeParse({ email: "invalid" }).success, false);
});

test("validates authenticated password changes", () => {
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-password", newPassword: "Password1!" }).success, true);
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "", newPassword: "Password1!" }).success, false);
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-password", newPassword: "Password1" }).success, false);
	assert.equal(passwordChangeSchema.safeParse({ currentPassword: "old-password", newPassword: "Password1!", unexpected: true }).success, false);
});