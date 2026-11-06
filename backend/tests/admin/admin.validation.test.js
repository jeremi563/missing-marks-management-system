import test from "node:test";
import assert from "node:assert/strict";
import { createUserBody, updateUserBody, userListQuery } from "../../src/modules/admin/admin.validation.js";

test("administrator user validation accepts required student and lecturer profile identifiers", () => {
	assert.equal(createUserBody.safeParse({ email: "student@example.test", password: "password-12345", displayName: "Student", roles: ["student"], studentNumber: "STU-1" }).success, true);
	assert.equal(createUserBody.safeParse({ email: "lecturer@example.test", password: "password-12345", displayName: "Lecturer", roles: ["lecturer"], staffNumber: "STAFF-1" }).success, true);
});

test("administrator user validation rejects duplicate and unknown roles", () => {
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["administrator", "administrator"] }).success, false);
	assert.equal(createUserBody.safeParse({ email: "admin@example.test", password: "password-12345", displayName: "Admin", roles: ["super-admin"] }).success, false);
});

test("administrator user validation requires update fields and normalizes list filters", () => {
	assert.equal(updateUserBody.safeParse({}).success, false);
	assert.deepEqual(userListQuery.parse({ page: "2", limit: "25", isActive: "false" }), { page: 2, limit: 25, isActive: false });
});