import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { loginWithCredentials, registerAccount } = await import("../../src/modules/auth/auth.service.js");

const makeUser = async (overrides = {}) => ({
	id: "00000000-0000-4000-8000-000000000001",
	email: "student@example.test",
	displayName: "Student",
	passwordHash: await bcrypt.hash("student-password", 4),
	isActive: true,
	approvalStatus: "APPROVED",
	emailVerifiedAt: new Date(),
	roles: [{ role: { name: "student" } }],
	...overrides,
});

test("logs in by normalized student registration number", async () => {
	const user = await makeUser();
	let queriedValue;
	const result = await loginWithCredentials(" stu-001 ", "student-password", {
		accountLoginIdentifier: { findUnique: async ({ where }) => { queriedValue = where.value; return { user }; } },
		user: { findUnique: async () => null },
	});
	assert.equal(queriedValue, "STU-001");
	assert.deepEqual(jwt.decode(result.token).roles, ["student"]);
	assert.equal(result.user.email, user.email);
});

test("keeps legacy email login and blocks unapproved or unverified accounts", async () => {
	const user = await makeUser();
	const db = {
		accountLoginIdentifier: { findUnique: async () => null },
		user: { findUnique: async () => user },
	};
	assert.equal((await loginWithCredentials(user.email, "student-password", db)).user.id, user.id);
	await assert.rejects(loginWithCredentials("STU-001", "student-password", {
		accountLoginIdentifier: { findUnique: async () => ({ user: { ...user, approvalStatus: "PENDING" } }) },
		user: { findUnique: async () => null },
	}), { statusCode: 401 });
	await assert.rejects(loginWithCredentials("STU-001", "student-password", {
		accountLoginIdentifier: { findUnique: async () => ({ user: { ...user, emailVerifiedAt: null } }) },
		user: { findUnique: async () => null },
	}), { statusCode: 401 });
});

function registrationHarness(role) {
	const calls = {};
	const tx = {
		user: {
			findUnique: async () => null,
			create: async ({ data }) => { calls.user = data; return { id: "00000000-0000-4000-8000-000000000002" }; },
		},
		studentRegistrationEligibility: {
			findUnique: async () => ({ studentNumber: "STU-001", email: "student@example.test", linkedUserId: null }),
			update: async ({ data }) => { calls.rosterLink = data.linkedUserId; },
		},
		accountLoginIdentifier: { findUnique: async () => null, create: async ({ data }) => { calls.identifier = data; } },
		role: { upsert: async () => ({ id: "role-id" }) },
		userRole: { create: async () => { calls.roleAssigned = true; } },
		studentProfile: { create: async ({ data }) => { calls.studentProfile = data; } },
		lecturerProfile: { create: async ({ data }) => { calls.lecturerProfile = data; } },
		accountSecurityToken: {
			updateMany: async () => ({ count: 0 }),
			create: async ({ data }) => { calls.token = data; },
		},
	};
	return { calls, db: { $transaction: async (callback) => callback(tx) }, role };
}

test("registers a roster-matched student with a hashed password and token", async () => {
	const harness = registrationHarness("student");
	let delivered;
	const result = await registerAccount({
		role: "student", email: " Student@Example.Test ", password: "student-password", studentNumber: " stu-001 ",
	}, harness.db, async (email, token) => { delivered = { email, token }; });
	assert.deepEqual(result, { status: "PENDING_EMAIL_VERIFICATION" });
	assert.equal(harness.calls.user.email, "student@example.test");
	assert.equal(harness.calls.user.approvalStatus, "APPROVED");
	assert.equal(harness.calls.user.isActive, true);
	assert.equal(await bcrypt.compare("student-password", harness.calls.user.passwordHash), true);
	assert.deepEqual(harness.calls.identifier, { userId: "00000000-0000-4000-8000-000000000002", type: "STUDENT_NUMBER", value: "STU-001" });
	assert.equal(harness.calls.rosterLink, "00000000-0000-4000-8000-000000000002");
	assert.notEqual(harness.calls.token.tokenHash, delivered.token);
	assert.equal(delivered.email, "student@example.test");
});

test("registers COD applications pending approval without creating lecturer profiles", async () => {
	const harness = registrationHarness("cod");
	const result = await registerAccount({ role: "cod", email: "cod@example.test", password: "staff-password", staffNumber: " cod-001 " }, harness.db, async () => {});
	assert.deepEqual(result, { status: "PENDING_EMAIL_AND_ADMIN_APPROVAL" });
	assert.equal(harness.calls.user.approvalStatus, "PENDING");
	assert.equal(harness.calls.user.isActive, false);
	assert.equal(harness.calls.identifier.type, "STAFF_NUMBER");
	assert.equal(harness.calls.identifier.value, "COD-001");
	assert.equal(harness.calls.lecturerProfile, undefined);
});