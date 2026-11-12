import test from "node:test";
import assert from "node:assert/strict";
import { accountApprovalBody, createUserBody, rosterImportBody, updateUserBody, userListQuery } from "../../src/modules/admin/admin.validation.js";

test("administrator user creation accepts only administrator and COD profile identifiers", () => {
	const year = new Date().getFullYear();
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator"], adminNumber: `admin/12/${year}` }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["lecturer", "cod"], staffNumber: "AB/0123/STAFF9" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "student@example.test", password: "password-12345", displayName: "Student", roles: ["student"], studentNumber: `AB/01243/${year}` }).success, false);
	assert.equal(createUserBody.safeParse({ email: "lecturer@example.test", password: "password-12345", displayName: "Lecturer", roles: ["lecturer"], staffNumber: "AB/0123/STAFF9" }).success, false);
	assert.equal(createUserBody.safeParse({ email: "short@example.test", password: "1234567", displayName: "Admin", roles: ["administrator"], adminNumber: `admin/12/${year}` }).success, false);
});

test("administrator user validation rejects duplicate and unknown roles", () => {
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator", "administrator"] }).success, false);
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["super-admin"] }).success, false);
	const year = new Date().getFullYear();
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator"], adminNumber: `admin/12/${year}` }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["cod", "lecturer"], staffNumber: "AB/0123/STAFF9" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["cod"], staffNumber: "AB/0123/STAFF9" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "mixed@example.test", password: "password-12345", displayName: "Mixed", roles: ["student", "lecturer"], studentNumber: `AB/01243/${year}`, staffNumber: "AB/0123/STAFF9" }).success, false);
});

test("administrator user validation requires update fields and normalizes list filters", () => {
	assert.equal(updateUserBody.safeParse({}).success, false);
	assert.equal(updateUserBody.safeParse({ studentNumber: "IN/01243/2026" }).success, false);
	assert.equal(updateUserBody.safeParse({ staffNumber: "IN/0123/STAFF9" }).success, false);
	assert.equal(updateUserBody.safeParse({ adminNumber: "admin/12/2026" }).success, false);
	assert.deepEqual(userListQuery.parse({ page: "2", limit: "25", isActive: "false", approvalStatus: "APPROVED" }), { page: 2, limit: 25, isActive: false, approvalStatus: "APPROVED" });
	assert.equal(userListQuery.safeParse({ approvalStatus: "UNKNOWN" }).success, false);
	const year = new Date().getFullYear();
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: `AB/01243/${year}`, email: "student@example.test" }] }).success, true);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: `AB/01243/${year}`, email: "student@example.test" }, { studentNumber: `ab/01243/${year}`, email: "other@example.test" }] }).success, false);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: `AB/01243/${year + 1}`, email: "future@example.test" }] }).success, false);
	assert.equal(accountApprovalBody.safeParse({ status: "APPROVED" }).success, true);
	assert.equal(accountApprovalBody.safeParse({ status: "REJECTED" }).success, true);
	assert.equal(accountApprovalBody.safeParse({ status: "APPROVED", roles: ["lecturer", "cod"] }).success, false);
});