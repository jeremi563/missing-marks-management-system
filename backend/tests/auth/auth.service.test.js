import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { changePassword, completeLecturerDepartmentRegistration, extendSession, listRegistrationDepartments, loginWithCredentials, registerAccount, requestEmailChange, resetPassword, updateAvatar, verifyEmailAddress } = await import("../../src/modules/auth/auth.service.js");

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

test("rejects missing login identifiers without throwing a server error", async () => {
	await assert.rejects(loginWithCredentials(undefined, "student-password", {
		accountLoginIdentifier: { findUnique: async () => null },
	}), { statusCode: 401 });
	await assert.rejects(loginWithCredentials(null, "student-password", {
		accountLoginIdentifier: { findUnique: async () => null },
	}), { statusCode: 401 });
});

test("logs in by normalized student registration number", async () => {
	const user = await makeUser();
	const studentNumber = `IN16/01243/${String(new Date().getFullYear() % 100).padStart(2, "0")}`;
	let queriedValue;
	const result = await loginWithCredentials(` ${studentNumber.toLowerCase()} `, "student-password", {
		accountLoginIdentifier: { findUnique: async ({ where }) => { queriedValue = where.value; return { user }; } },
	});
	assert.equal(queriedValue, studentNumber);
	assert.deepEqual(jwt.decode(result.token).roles, ["student"]);
	assert.equal(result.user.email, user.email);
	assert.ok(Math.abs(Date.parse(result.sessionExpiresAt) - jwt.decode(result.token).exp * 1000) < 1000);
});

test("extends an authenticated session for 15 minutes", () => {
	const result = extendSession({ id: "user-1", roles: ["student"], sessionVersion: 4 });
	const claims = jwt.verify(result.token, process.env.JWT_SECRET);
	assert.equal(claims.sub, "user-1");
	assert.deepEqual(claims.roles, ["student"]);
	assert.equal(claims.sessionVersion, 4);
	assert.ok(claims.exp - claims.iat >= 14 * 60);
	assert.ok(claims.exp - claims.iat <= 15 * 60);
	assert.equal(Date.parse(result.sessionExpiresAt), claims.exp * 1000);
});

test("uses the same registration-number login for every account role", async () => {
	const year = new Date().getFullYear();
	const accounts = [
		{ role: "student", number: `IN16/01243/${String(year % 100).padStart(2, "0")}` },
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
	let updatedUser;
	await changePassword(user.id, "student-password", "new-password-123", {
		user: {
			findUnique: async () => ({ passwordHash: user.passwordHash }),
			update: async ({ where, data }) => {
				assert.equal(where.id, user.id);
				updatedUser = data;
			},
		},
	});
	assert.equal(await bcrypt.compare("new-password-123", updatedUser.passwordHash), true);
	assert.notEqual(updatedUser.passwordHash, user.passwordHash);
	assert.equal(updatedUser.mustChangePassword, false);
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

function registrationHarness(eligibility, existingUser = null, course = { id: "course-id" }) {
	const calls = {};
	const tx = {
		course: { findFirst: async () => course },
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

test("resets a password, consumes the token, and increments the session version", async () => {
	const now = new Date();
	let updatedUser;
	const tokenUpdates = [];
	await resetPassword("valid-reset-token", "new-password-123", {
		$transaction: async (callback) => callback({
			accountSecurityToken: {
				findUnique: async () => ({ id: "reset-token-id", userId: "user-1", type: "PASSWORD_RESET", usedAt: null, expiresAt: new Date(now.getTime() + 60_000) }),
				updateMany: async ({ where, data }) => {
					tokenUpdates.push({ where, data });
					return { count: 1 };
				},
			},
			user: { update: async ({ where, data }) => { updatedUser = { where, data }; } },
		}),
	});
	assert.equal(updatedUser.where.id, "user-1");
	assert.equal(await bcrypt.compare("new-password-123", updatedUser.data.passwordHash), true);
	assert.equal(updatedUser.data.mustChangePassword, false);
	assert.deepEqual(updatedUser.data.sessionVersion, { increment: 1 });
	assert.equal(tokenUpdates.length, 2);
	assert.equal(tokenUpdates[0].where.id, "reset-token-id");
	assert.equal(tokenUpdates[1].where.type, "PASSWORD_RESET");
});

test("first roster sign-in provisions a student and requires a private password", async () => {
	const studentNumber = `IN16/01243/${String(new Date().getFullYear() % 100).padStart(2, "0")}`;
	const calls = {};
	const userId = "00000000-0000-4000-8000-000000000002";
	const eligibility = { id: "eligibility-id", studentNumber: studentNumber.toUpperCase(), email: "student@example.test", linkedUserId: null };
	const tx = {
		studentRegistrationEligibility: {
			findUnique: async () => eligibility,
			updateMany: async ({ data }) => { calls.linkedUserId = data.linkedUserId; return { count: 1 }; },
		},
		course: { findFirst: async () => ({ id: "course-id" }) },
		user: {
			findUnique: async () => null,
			create: async ({ data }) => { calls.user = data; return { id: userId, ...data }; },
		},
		role: { upsert: async () => ({ id: "student-role", name: "student" }) },
		userRole: { create: async ({ data }) => { calls.userRole = data; } },
		accountLoginIdentifier: { create: async ({ data }) => { calls.identifier = data; } },
		studentProfile: { create: async ({ data }) => { calls.profile = data; } },
	};
	const db = {
		accountLoginIdentifier: { findUnique: async () => null },
		$transaction: async (callback) => callback(tx),
	};

	const result = await loginWithCredentials(studentNumber.toLowerCase(), studentNumber.toLowerCase(), db);

	assert.equal(result.user.id, userId);
	assert.equal(result.user.mustChangePassword, true);
	assert.deepEqual(result.user.roles, ["student"]);
	assert.equal(calls.user.email, "student@example.test");
	assert.equal(calls.user.isActive, true);
	assert.equal(calls.user.approvalStatus, "APPROVED");
	assert.equal(calls.user.mustChangePassword, true);
	assert.ok(calls.user.emailVerifiedAt instanceof Date);
	assert.equal(await bcrypt.compare(studentNumber, calls.user.passwordHash), true);
	assert.deepEqual(calls.identifier, { userId, type: "STUDENT_NUMBER", value: studentNumber.toUpperCase() });
	assert.deepEqual(calls.profile, { userId, studentNumber: studentNumber.toUpperCase(), officialEmail: "student@example.test" });
	assert.equal(calls.linkedUserId, userId);
});

test("does not provision a roster student when the temporary password does not match", async () => {
	const studentNumber = `IN16/01243/${String(new Date().getFullYear() % 100).padStart(2, "0")}`;
	let transactionStarted = false;
	await assert.rejects(loginWithCredentials(studentNumber, "wrong-password", {
		accountLoginIdentifier: { findUnique: async () => null },
		$transaction: async () => { transactionStarted = true; },
	}), { statusCode: 401 });
	assert.equal(transactionStarted, false);
});

test("does not provision a roster student when its department course no longer exists", async () => {
	const studentNumber = `IN16/01243/${String(new Date().getFullYear() % 100).padStart(2, "0")}`;
	const db = {
		accountLoginIdentifier: { findUnique: async () => null },
		$transaction: async (callback) => callback({
			studentRegistrationEligibility: { findUnique: async () => ({ id: "eligibility-id", studentNumber, email: "student@example.test", linkedUserId: null }) },
			course: { findFirst: async () => null },
		}),
	};
	await assert.rejects(loginWithCredentials(studentNumber, studentNumber, db), { statusCode: 422 });
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

test("rejects self-registration using a student roster number", async () => {
	const studentNumber = `IN16/01243/${String(new Date().getFullYear() % 100).padStart(2, "0")}`;
	let transactionStarted = false;
	await assert.rejects(registerAccount({
		email: "student@example.test",
		password: "student-password",
		displayName: "Student",
		registrationNumber: studentNumber,
	}, { $transaction: async () => { transactionStarted = true; } }), { statusCode: 403 });
	assert.equal(transactionStarted, false);
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

test("lecturer department registration assigns a primary department and requests additional memberships", async () => {
	const userId = "00000000-0000-4000-8000-000000000005";
	const departmentId = "00000000-0000-4000-8000-000000000006";
	const additionalDepartmentId = "00000000-0000-4000-8000-000000000007";
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
	const notifications = [];
	const audits = [];
	const tx = {
		department: {
			findMany: async () => [
				{ id: departmentId, name: "Computing", code: "COMP", designatedCodUserId: "primary-cod" },
				{ id: additionalDepartmentId, name: "Mathematics", code: "MATH", designatedCodUserId: "additional-cod" },
			],
		},
		user: {
			findUnique: async () => user,
			findFirst: async ({ where }) => ({ id: where.id }),
		},
		departmentMembership: { create: async ({ data }) => calls.push(data) },
		departmentMembershipRequest: {
			create: async ({ data }) => ({ id: "request-id", ...data, status: "PENDING" }),
		},
		notification: { create: async ({ data }) => notifications.push(data) },
		auditLog: { create: async ({ data }) => audits.push(data) },
	};
	const result = await completeLecturerDepartmentRegistration({
		email: " Lecturer@Example.Test ",
		password: "staff-password",
		displayName: " Lecturer ",
		registrationNumber: "ab/0123/staff9",
		departmentIds: [departmentId, additionalDepartmentId],
		primaryDepartmentId: departmentId,
	}, { $transaction: (callback) => callback(tx) });

	assert.deepEqual(result, {
		status: "PENDING_COD_APPROVAL",
		department: { id: departmentId, name: "Computing", code: "COMP" },
		additionalDepartments: [{ id: additionalDepartmentId, name: "Mathematics", code: "MATH", requestStatus: "PENDING" }],
	});
	assert.deepEqual(calls, [{ userId, departmentId }]);
	assert.equal(notifications[0].userId, "additional-cod");
	assert.equal(audits[0].metadata.source, "LECTURER_REGISTRATION");
});

test("lists all departments for lecturer registration, including departments without a designated COD", async () => {
	let query;
	const departments = [
		{ id: "department-1", name: "Computing", code: "COMP" },
		{ id: "department-2", name: "Mathematics", code: "MATH" },
	];
	const result = await listRegistrationDepartments({
		department: { findMany: async (args) => { query = args; return departments; } },
	});

	assert.deepEqual(result, departments);
	assert.deepEqual(query, {
		select: { id: true, name: true, code: true },
		orderBy: [{ name: "asc" }, { code: "asc" }],
	});
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
		department: { findMany: async () => [{ id: "department-id", name: "Computing", code: "COMP", designatedCodUserId: "cod-user" }] },
		departmentMembership: { create: async () => { assignmentCount += 1; } },
	};
	await assert.rejects(completeLecturerDepartmentRegistration({
		email: user.email,
		password: "incorrect-password",
		displayName: user.displayName,
		registrationNumber: "AB/0123/STAFF9",
		departmentIds: ["department-id"],
		primaryDepartmentId: "department-id",
	}, { $transaction: (callback) => callback(tx) }), { statusCode: 422 });
	assert.equal(assignmentCount, 0);
});

test("treats first-sign-in registration numbers as case insensitive", async () => {
	const studentNumber = `IN16/01243/${String(new Date().getFullYear() % 100).padStart(2, "0")}`;
	const lowerCaseNumber = studentNumber.toLowerCase();
	const userId = "00000000-0000-4000-8000-000000000002";
	const eligibility = { id: "eligibility-id", studentNumber, email: "student@example.test", linkedUserId: null };
	const db = {
		accountLoginIdentifier: { findUnique: async () => null },
		$transaction: async (callback) => callback({
			studentRegistrationEligibility: {
				findUnique: async () => eligibility,
				updateMany: async () => ({ count: 1 }),
			},
			course: { findFirst: async () => ({ id: "course-id" }) },
			user: {
				findUnique: async () => null,
				create: async ({ data }) => ({ id: userId, ...data }),
			},
			role: { upsert: async () => ({ id: "student-role", name: "student" }) },
			userRole: { create: async () => {} },
			accountLoginIdentifier: { create: async () => {} },
			studentProfile: { create: async () => {} },
		}),
	};
	const result = await loginWithCredentials(lowerCaseNumber, lowerCaseNumber, db);
	assert.equal(result.user.id, userId);
});

test("rejects identifiers that do not match a student roster or staff format", async () => {
	const harness = registrationHarness(null);
	await assert.rejects(registerAccount({
		email: "unknown@example.test", password: "staff-password", displayName: "Unknown", registrationNumber: "UNKNOWN-1",
	}, harness.db, async () => {}), { statusCode: 422 });
});