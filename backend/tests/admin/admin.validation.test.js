import test from "node:test";
import assert from "node:assert/strict";
import { accountApprovalBody, createUserBody, rosterImportBody, updateUserBody, userListQuery } from "../../src/modules/admin/admin.validation.js";

test("administrator user validation accepts required student and lecturer profile identifiers", () => {
	assert.equal(createUserBody.safeParse({ email: "student@example.test", password: "password-12345", displayName: "Student", roles: ["student"], studentNumber: "STU-1" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "lecturer@example.test", password: "password-12345", displayName: "Lecturer", roles: ["lecturer"], staffNumber: "STAFF-1" }).success, true);
});

test("administrator user validation rejects duplicate and unknown roles", () => {
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator", "administrator"] }).success, false);
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["super-admin"] }).success, false);
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator"], adminNumber: "ADM-1" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "cod@example.test", password: "password-12345", displayName: "COD", roles: ["cod", "lecturer"], staffNumber: "STAFF-1" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "mixed@example.test", password: "password-12345", displayName: "Mixed", roles: ["student", "lecturer"], studentNumber: "STU-1", staffNumber: "STAFF-1" }).success, false);
});

test("administrator user validation requires update fields and normalizes list filters", () => {
	assert.equal(updateUserBody.safeParse({}).success, false);
	assert.deepEqual(userListQuery.parse({ page: "2", limit: "25", isActive: "false" }), { page: 2, limit: 25, isActive: false });
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: "STU-1", email: "student@example.test" }] }).success, true);
	assert.equal(rosterImportBody.safeParse({ students: [{ studentNumber: "STU-1", email: "student@example.test" }, { studentNumber: "stu-1", email: "other@example.test" }] }).success, false);
	assert.equal(accountApprovalBody.safeParse({ status: "APPROVED", roles: ["lecturer", "cod"] }).success, true);
	assert.equal(accountApprovalBody.safeParse({ status: "APPROVED", roles: ["student"] }).success, false);
});