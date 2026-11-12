import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { changePassword, completeLecturerDepartmentRegistration, extendSession, loginWithCredentials, registerAccount, requestEmailChange, updateAvatar, verifyEmailAddress } = await import("../../src/modules/auth/auth.service.js");

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
	const result = await loginWithCredentials(` ab/01243/${new Date().getFullYear()} `, "student-password", {
		accountLoginIdentifier: { findUnique: async ({ where }) => { queriedValue = where.value; return { user }; } },
	});
	assert.equal(queriedValue, `AB/01243/${new Date().getFullYear()}`);
	assert.deepEqual(jwt.decode(result.token).roles, ["student"]);
	assert.equal(result.user.email, user.email);
	assert.ok(Math.abs(Date.parse(result.sessionExpiresAt) - jwt.decode(result.token).exp * 1000) < 1000);
});

test("extends an authenticated session for 15 minutes", () => {
	const result = extendSession({ id: "user-1", roles: ["student"] });
	const claims = jwt.verify(result.token, process.env.JWT_SECRET);
	assert.equal(claims.sub, "user-1");
	assert.deepEqual(claims.roles, ["student"]);
	assert.ok(claims.exp - claims.iat >= 14 * 60);
	assert.ok(claims.exp - claims.iat <= 15 * 60);
	assert.equal(Date.parse(result.sessionExpiresAt), claims.exp * 1000);
});

test("uses the same registration-number login for every account role", async () => {
	const year = new Date().getFullYear();
	const accounts = [
		{ role: "student", number: `AB/01243/${year}` },
		{ role: "lecturer", number: "AB/0123/STAFF9" },
		{ role: "cod", number: "CD/0456/STAFF2" },
		{ role: "administrator", number: `ADMIN/12/${year}` },
	];

	for (const { role, number } of accounts) {
		const user = await makeUser({ roles: [{ role: { name: role } }] });
		const result = await loginWithCredentials(number, "student-password", {
			accountLoginIdentifier: {
				findUnique: async ({ where }) => where.value === number
					? { user }
					: null,
			},
		});
		assert.deepEqual(result.user.roles, [role]);
	}
});

test("allows an active, approved lecturer to sign in without email verification", async () => {
	const user = await makeUser({
		emailVerifiedAt: null,
		roles: [{ role: { name: "lecturer" } }],
	});
	const result = await loginWithCredentials("AB/0123/STAFF9", "student-password", {
		accountLoginIdentifier: { findUnique: async () => ({ user }) },
	});
	assert.deepEqual(result.user.roles, ["lecturer"]);
});

test("requires a registration number and blocks unapproved or unverified non-staff accounts", async () => {
	const user = await makeUser();
	let emailLookupAttempted = false;
	const db = {
		accountLoginIdentifier: { findUnique: async () => null },
		user: { findUnique: async () => { emailLookupAttempted = true; return user; } },
	};
	await assert.rejects(loginWithCredentials(user.email, "student-password", db), { statusCode: 401 });
	assert.equal(emailLookupAttempted, false);
	await assert.rejects(loginWithCredentials("STU-001", "student-password", {
		accountLoginIdentifier: { findUnique: async () => ({ user: { ...user, approvalStatus: "PENDING" } }) },
	}), { statusCode: 401 });
	await assert.rejects(loginWithCredentials("STU-001", "student-password", {
		accountLoginIdentifier: { findUnique: async () => ({ user: { ...user, emailVerifiedAt: null } }) },
	}), { statusCode: 401 });
	await assert.rejects(loginWithCredentials("AB/0123/STAFF9", "student-password", {
		accountLoginIdentifier: { findUnique: async () => ({ user: { ...user, approvalStatus: "PENDING", emailVerifiedAt: null, roles: [{ role: { name: "lecturer" } }] } }) },
	}), { statusCode: 401 });
});

test("changes a password only after verifying the current password", async () => {
	const user = await makeUser();
	let updatedPasswordHash;
	await changePassword(user.id, "student-password", "new-password-123", {
		user: {
			findUnique: async () => ({ passwordHash: user.passwordHash }),
			update: async ({ where, data }) => {
				assert.equal(where.id, user.id);
				updatedPasswordHash = data.passwordHash;
			},
		},
	});
	assert.equal(await bcrypt.compare("new-password-123", updatedPasswordHash), true);
	assert.notEqual(updatedPasswordHash, user.passwordHash);
});

test("does not change password when the current password is incorrect", async () => {
	const user = await makeUser();
	let updateCalled = false;
	await assert.rejects(changePassword(user.id, "incorrect-password", "new-password-123", {
		user: {
			findUnique: async () => ({ passwordHash: user.passwordHash }),
			update: async () => { updateCalled = true; },
		},
	}), { statusCode: 401 });
	assert.equal(updateCalled, false);
});

test("requests an email change only after verifying the current password", async () => {
	const user = await makeUser();
	const tokenWrites = [];
	const sent = [];
	const db = {
		user: { findUnique: async ({ where }) => where.id ? user : null },
		$transaction: async (callback) => callback({
			user: { update: async ({ data }) => Object.assign(user, data) },
			accountSecurityToken: {
				updateMany: async () => ({ count: 0 }),
				create: async ({ data }) => tokenWrites.push(data),
			},
		}),
	};
	const result = await requestEmailChange(user.id, " New@Example.Test ", "student-password", db, async (email, token) => sent.push({ email, token }));
	assert.deepEqual(result, { pendingEmail: "new@example.test", verificationEmailSent: true });
	assert.equal(user.email, "student@example.test");
	assert.equal(user.pendingEmail, "new@example.test");
	assert.equal(tokenWrites[0].type, "EMAIL_CHANGE");
	assert.equal(sent[0].email, "new@example.test");
});

test("does not request an email change when the current password is incorrect", async () => {
	const user = await makeUser();
	let transactionStarted = false;
	await assert.rejects(requestEmailChange(user.id, "new@example.test", "incorrect-password", {
		user: { findUnique: async () => user },
		$transaction: async () => { transactionStarted = true; },
	}), { statusCode: 401 });
	assert.equal(transactionStarted, false);
});

test("confirms a pending email change with its verification token", async () => {
	const pendingEmail = "new@example.test";
	let userUpdate;
	const result = await verifyEmailAddress("verification-token", {
		$transaction: async (callback) => callback({
			accountSecurityToken: {
				findUnique: async () => ({
					id: "token-id",
					userId: "user-id",
					type: "EMAIL_CHANGE",
					usedAt: null,
					expiresAt: new Date(Date.now() + 60_000),
					user: { pendingEmail, approvalStatus: "APPROVED" },
				}),
				updateMany: async () => ({ count: 1 }),
			},
			user: { update: async ({ data }) => { userUpdate = data; return { email: pendingEmail }; } },
		}),
	});
	assert.equal(userUpdate.email, pendingEmail);
	assert.equal(userUpdate.pendingEmail, null);
	assert.ok(userUpdate.emailVerifiedAt instanceof Date);
	assert.deepEqual(result, { status: "APPROVED", email: pendingEmail });
});

test("validates uploaded avatar image signatures and supports removal", async () => {
	const userId = "00000000-0000-4000-8000-000000000001";
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
	let updatedData;
	const db = { user: { update: async ({ data }) => { updatedData = data; return { avatarData: data.avatarData }; } } };
	const avatarData = `data:image/png;base64,${png.toString("base64")}`;
	assert.deepEqual(await updateAvatar(userId, avatarData, db), { avatarData });
	assert.deepEqual(updatedData, { avatarData });
	await assert.rejects(updateAvatar(userId, "data:image/png;base64,not-a-png", db), { statusCode: 422 });
	assert.deepEqual(await updateAvatar(userId, null, db), { avatarData: null });
});

function registrationHarness(eligibility, existingUser = null) {
	const calls = {};
	const tx = {
		user: {
			findUnique: async ({ where }) => where.id ? existingUser : null,
			create: async ({ data }) => { calls.user = data; return { id: "00000000-0000-4000-8000-000000000002" }; },
			update: async ({ where, data }) => { calls.userUpdate = { where, data }; },
		},
		studentRegistrationEligibility: {
			findUnique: async () => eligibility,
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
	return { calls, db: { $transaction: async (callback) => callback(tx) } };
}

test("registers a roster-matched student as verified with a hashed password", async () => {
	const studentNumber = `AB/01243/${new Date().getFullYear()}`;
	const harness = registrationHarness({ studentNumber, email: "student@example.test", linkedUserId: null });
	const result = await registerAccount({
		email: " Student@Example.Test ", password: "student-password", displayName: "Student", registrationNumber: ` ${studentNumber.toLowerCase()} `,
	}, harness.db, async () => assert.fail("Roster-matched students do not need verification email"));
	assert.deepEqual(result, { status: "REGISTERED", verificationEmailSent: false, requiresEmailVerification: false });
	assert.equal(harness.calls.user.email, "student@example.test");
	assert.equal(harness.calls.user.approvalStatus, "APPROVED");
	assert.equal(harness.calls.user.isActive, true);
	assert.ok(harness.calls.user.emailVerifiedAt instanceof Date);
	assert.equal(await bcrypt.compare("student-password", harness.calls.user.passwordHash), true);
	assert.deepEqual(harness.calls.identifier, { userId: "00000000-0000-4000-8000-000000000002", type: "STUDENT_NUMBER", value: studentNumber });
	assert.equal(harness.calls.rosterLink, "00000000-0000-4000-8000-000000000002");
	assert.equal(harness.calls.token, undefined);
});

test("registers numbers absent from the student roster as staff pending approval", async () => {
	const harness = registrationHarness(null);
	const result = await registerAccount({ email: "lecturer@example.test", password: "staff-password", displayName: "Lecturer", registrationNumber: " ab/0123/staff9 " }, harness.db);
	assert.deepEqual(result, { status: "PENDING_DEPARTMENT_REGISTRATION", verificationEmailSent: false, requiresEmailVerification: false, requiresDepartmentRegistration: true });
	assert.equal(harness.calls.user.approvalStatus, "PENDING");
	assert.equal(harness.calls.user.isActive, false);
	assert.equal(harness.calls.identifier.type, "STAFF_NUMBER");
	assert.equal(harness.calls.identifier.value, "AB/0123/STAFF9");
	assert.deepEqual(harness.calls.lecturerProfile, { userId: "00000000-0000-4000-8000-000000000002", staffNumber: "AB/0123/STAFF9" });
	assert.equal(harness.calls.token, undefined);
});

test("staff registration does not require email verification delivery", async () => {
	const harness = registrationHarness(null);
	const result = await registerAccount({
		email: "lecturer@example.test",
		password: "staff-password",
		displayName: "Lecturer",
		registrationNumber: "AB/0123/STAFF9",
	}, harness.db);

	assert.deepEqual(result, { status: "PENDING_DEPARTMENT_REGISTRATION", verificationEmailSent: false, requiresEmailVerification: false, requiresDepartmentRegistration: true });
	assert.equal(harness.calls.token, undefined);
});

test("lecturer department registration links the verified details to the pending account", async () => {
	const userId = "00000000-0000-4000-8000-000000000005";
	const departmentId = "00000000-0000-4000-8000-000000000006";
	const user = {
		id: userId,
		email: "lecturer@example.test",
		displayName: "Lecturer",
		passwordHash: await bcrypt.hash("staff-password", 4),
		isActive: false,
		approvalStatus: "PENDING",
		roles: [{ role: { name: "lecturer" } }],
		loginIdentifiers: [{ type: "STAFF_NUMBER", value: "AB/0123/STAFF9" }],
		departmentMemberships: [],
	};
	const calls = [];
	const tx = {
		user: { findUnique: async () => user },
		department: { findUnique: async () => ({ id: departmentId, name: "Computing", code: "COMP", designatedCodUserId: "cod-user" }) },
		departmentMembership: { create: async ({ data }) => calls.push(data) },
	};
	const result = await completeLecturerDepartmentRegistration({
		email: " Lecturer@Example.Test ",
		password: "staff-password",
		displayName: " Lecturer ",
		registrationNumber: "ab/0123/staff9",
		departmentId,
	}, { $transaction: (callback) => callback(tx) });

	assert.deepEqual(result, { status: "PENDING_COD_APPROVAL", department: { id: departmentId, name: "Computing", code: "COMP" } });
	assert.deepEqual(calls, [{ userId, departmentId }]);
});

test("lecturer department registration rejects incorrect credentials without assigning a department", async () => {
	const user = {
		id: "00000000-0000-4000-8000-000000000005",
		email: "lecturer@example.test",
		displayName: "Lecturer",
		passwordHash: await bcrypt.hash("staff-password", 4),
		isActive: false,
		approvalStatus: "PENDING",
		roles: [{ role: { name: "lecturer" } }],
		loginIdentifiers: [{ type: "STAFF_NUMBER", value: "AB/0123/STAFF9" }],
		departmentMemberships: [],
	};
	let assignmentCount = 0;
	const tx = {
		user: { findUnique: async () => user },
		department: { findUnique: async () => ({ id: "department-id", name: "Computing", code: "COMP", designatedCodUserId: "cod-user" }) },
		departmentMembership: { create: async () => { assignmentCount += 1; } },
	};
	await assert.rejects(completeLecturerDepartmentRegistration({
		email: user.email,
		password: "incorrect-password",
		displayName: user.displayName,
		registrationNumber: "AB/0123/STAFF9",
		departmentId: "department-id",
	}, { $transaction: (callback) => callback(tx) }), { statusCode: 422 });
	assert.equal(assignmentCount, 0);
});

test("recovers an existing unverified roster-linked student account", async () => {
	const studentNumber = `AB/01243/${new Date().getFullYear()}`;
	const studentId = "00000000-0000-4000-8000-000000000003";
	const existingUser = {
		id: studentId,
		email: "student@example.test",
		emailVerifiedAt: null,
		approvalStatus: "APPROVED",
		roles: [{ role: { name: "student" } }],
		studentProfile: { studentNumber },
	};
	const harness = registrationHarness({ studentNumber, email: "student@example.test", linkedUserId: studentId }, existingUser);
	const result = await registerAccount({
		email: "student@example.test",
		password: "replacement-password",
		displayName: "Student",
		registrationNumber: studentNumber,
	}, harness.db, async () => assert.fail("Roster-matched students do not need verification email"));

	assert.deepEqual(result, { status: "REGISTERED", verificationEmailSent: false, requiresEmailVerification: false });
	assert.deepEqual(harness.calls.userUpdate.where, { id: studentId });
	assert.equal(harness.calls.userUpdate.data.isActive, true);
	assert.ok(harness.calls.userUpdate.data.emailVerifiedAt instanceof Date);
	assert.equal(await bcrypt.compare("replacement-password", harness.calls.userUpdate.data.passwordHash), true);
});

test("does not allow re-registration of an already verified roster-linked student", async () => {
	const studentNumber = `AB/01243/${new Date().getFullYear()}`;
	const existingUser = {
		id: "00000000-0000-4000-8000-000000000003",
		email: "student@example.test",
		emailVerifiedAt: new Date(),
		approvalStatus: "APPROVED",
		roles: [{ role: { name: "student" } }],
		studentProfile: { studentNumber },
	};
	const harness = registrationHarness({ studentNumber, email: "student@example.test", linkedUserId: existingUser.id }, existingUser);
	await assert.rejects(registerAccount({
		email: "student@example.test",
		password: "replacement-password",
		displayName: "Student",
		registrationNumber: studentNumber,
	}, harness.db, async () => {}), { statusCode: 409 });
	assert.equal(harness.calls.userUpdate, undefined);
});

test("rejects roster-matched registration numbers with a different email", async () => {
	const studentNumber = `AB/01243/${new Date().getFullYear()}`;
	const harness = registrationHarness({ studentNumber, email: "student@example.test", linkedUserId: null });
	await assert.rejects(registerAccount({
		email: "other@example.test", password: "student-password", displayName: "Student", registrationNumber: studentNumber,
	}, harness.db, async () => {}), { statusCode: 422 });
});

test("rejects identifiers that do not match a student roster or staff format", async () => {
	const harness = registrationHarness(null);
	await assert.rejects(registerAccount({
		email: "unknown@example.test", password: "staff-password", displayName: "Unknown", registrationNumber: "UNKNOWN-1",
	}, harness.db, async () => {}), { statusCode: 422 });
});