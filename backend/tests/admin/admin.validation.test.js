import test from "node:test";
import assert from "node:assert/strict";
import { accountApprovalBody, createUserBody, rosterImportBody, updateUserBody, userListQuery } from "../../src/modules/admin/admin.validation.js";

test("administrator user creation accepts only administrator and COD profile identifiers", () => {
	const year = `${new Date().getFullYear() % 100}`.padStart(2, "0");
	const fullYear = new Date().getFullYear();
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator"], adminNumber: `admin/12/${fullYear}` }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["lecturer", "cod"], staffNumber: "AB/0123/STAFF9", departmentId: "00000000-0000-4000-8000-000000000001" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "student@example.test", password: "password-12345", displayName: "Student", roles: ["student"], studentNumber: `AB16/01243/${year}` }).success, false);
	assert.equal(createUserBody.safeParse({ email: "lecturer@example.test", password: "password-12345", displayName: "Lecturer", roles: ["lecturer"], staffNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(createUserBody.safeParse({ email: "short@example.test", password: "1234567", displayName: "Admin", roles: ["administrator"], adminNumber: `admin/12/${fullYear}` }).success, false);
});

test("administrator user validation rejects duplicate and unknown roles", () => {
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator", "administrator"] }).success, false);
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["super-admin"] }).success, false);
	const year = `${new Date().getFullYear() % 100}`.padStart(2, "0");
	const fullYear = new Date().getFullYear();
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator"], adminNumber: `admin/12/${fullYear}` }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["cod", "lecturer"], staffNumber: "AB/0123/STAFF9", departmentId: "00000000-0000-4000-8000-000000000001" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["cod"], staffNumber: "AB/0123/STAFF9", departmentId: "00000000-0000-4000-8000-000000000001" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["cod"], staffNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(createUserBody.safeParse({ email: "mixed@example.test", password: "password-12345", displayName: "Mixed", roles: ["student", "lecturer"], studentNumber: `AB16/01243/${year}`, staffNumber: "AB/0123/STAFF9" }).success, false);
});

test("administrator user validation requires update fields and normalizes list filters", () => {
	assert.equal(updateUserBody.safeParse({}).success, false);
	assert.equal(updateUserBody.safeParse({ password: "Password123" }).success, false);
	assert.equal(updateUserBody.safeParse({ password: "Password123!" }).success, true);
	const year = `${new Date().getFullYear() % 100}`.padStart(2, "0");
	assert.equal(updateUserBody.safeParse({ studentNumber: `IN16/01243/${year}` }).success, true);
	assert.equal(updateUserBody.safeParse({ staffNumber: "IN/0123/STAFF9" }).success, false);
	assert.equal(updateUserBody.safeParse({ adminNumber: "admin/12/2026" }).success, false);
	assert.deepEqual(userListQuery.parse({ page: "2", limit: "25", isActive: "false", approvalStatus: "APPROVED" }), { page: 2, limit: 25, isActive: false, approvalStatus: "APPROVED" });
	assert.equal(userListQuery.safeParse({ approvalStatus: "UNKNOWN" }).success, false);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: `AB16/01243/${year}`, fullName: "Taylor Student", email: "student@example.test" }] }).success, true);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: `AB16/01243/${year}`, fullName: " ", email: "student@example.test" }] }).success, false);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: `AB16/01243/${year}`, fullName: "Taylor Student", email: "student@example.test" }, { studentNumber: `ab16/01243/${year}`, fullName: "Alex Student", email: "other@example.test" }] }).success, false);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: "AB16/01243/12", fullName: "Taylor Student", email: "old-year@example.test" }] }).success, false);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: `AB16/01243/${String(Number(year) + 1).padStart(2, "0")}`, fullName: "Taylor Student", email: "future@example.test" }] }).success, false);
	assert.equal(accountApprovalBody.safeParse({ status: "APPROVED" }).success, true);
	assert.equal(accountApprovalBody.safeParse({ status: "REJECTED" }).success, true);
	assert.equal(accountApprovalBody.safeParse({ status: "APPROVED", roles: ["lecturer", "cod"] }).success, false);
});