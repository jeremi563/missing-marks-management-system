import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { AppError } from "../../shared/utils/app-error.js";

const userSelect = {
	id: true,
	email: true,
	displayName: true,
	isActive: true,
	approvalStatus: true,
	emailVerifiedAt: true,
	createdAt: true,
	updatedAt: true,
	roles: { select: { role: { select: { name: true } } } },
	loginIdentifiers: { select: { type: true, value: true } },
	studentProfile: { select: { id: true, studentNumber: true, officialEmail: true, notificationEmail: true } },
	lecturerProfile: { select: { id: true, staffNumber: true } },
};

function serializeUser(user) {
	return { ...user, roles: user.roles.map(({ role }) => role.name) };
}

function includeLecturerRole(roles) {
	const uniqueRoles = [...new Set(roles)];
	return uniqueRoles.includes("cod") && !uniqueRoles.includes("lecturer")
		? [...uniqueRoles, "lecturer"]
		: uniqueRoles;
}

async function validateRoles(tx, roles) {
	const requestedRoles = [...new Set(roles)];
	const supportedRoles = new Set(["student", "lecturer", "cod", "administrator"]);
	if (requestedRoles.some((name) => !supportedRoles.has(name))) {
		throw new AppError(422, "One or more requested roles do not exist");
	}
	const existingRoles = await tx.role.findMany({ where: { name: { in: requestedRoles } }, select: { id: true, name: true } });
	const rolesByName = new Map(existingRoles.map((role) => [role.name, role]));
	for (const name of requestedRoles) {
		if (!rolesByName.has(name)) {
			const role = await tx.role.upsert({
				where: { name },
				update: {},
				create: { name, description: `System ${name} role` },
				select: { id: true, name: true },
			});
			rolesByName.set(name, role);
		}
	}
	return requestedRoles.map((name) => rolesByName.get(name));
}

function validateProfileInputs({ roles, studentNumber, staffNumber, adminNumber, allowMissingStaffNumber = false }) {
	if (roles.includes("student") && (roles.length !== 1 || !studentNumber || staffNumber || adminNumber)) throw new AppError(422, "Student accounts require only a student number");
	if (roles.includes("administrator") && (roles.length !== 1 || !adminNumber || studentNumber || staffNumber)) throw new AppError(422, "Administrator accounts require only an administrator number");
	if (roles.some((role) => role === "lecturer" || role === "cod") && ((!staffNumber && !allowMissingStaffNumber) || studentNumber || adminNumber)) throw new AppError(422, "Staff accounts require only a staff number");
	if (!roles.some((role) => role === "lecturer" || role === "cod") && staffNumber) throw new AppError(422, "Staff number requires a staff role");
	if (!roles.includes("student") && studentNumber) throw new AppError(422, "Student number requires the student role");
	if (!roles.includes("administrator") && adminNumber) throw new AppError(422, "Administrator number requires the administrator role");
}

async function setLoginIdentifier(tx, userId, roles, { studentNumber, staffNumber, adminNumber }) {
	const identifier = roles.includes("student")
		? { type: "STUDENT_NUMBER", value: studentNumber }
		: roles.includes("administrator")
			? { type: "ADMIN_NUMBER", value: adminNumber }
			: { type: "STAFF_NUMBER", value: staffNumber };
	const current = await tx.accountLoginIdentifier.findFirst({ where: { userId }, select: { id: true } });
	if (current) await tx.accountLoginIdentifier.update({ where: { id: current.id }, data: identifier });
	else await tx.accountLoginIdentifier.create({ data: { userId, ...identifier } });
}

async function countActiveAdministrators(tx) {
	return tx.user.count({ where: { isActive: true, roles: { some: { role: { name: "administrator" } } } } });
}

async function validateRoleLifecycle(tx, { userId, currentRoles, nextRoles, nextIsActive }) {
	const disablingCod = currentRoles.includes("cod") && (!nextRoles.includes("cod") || !nextIsActive);
	if (disablingCod && await tx.department.count({ where: { designatedCodUserId: userId } })) {
		throw new AppError(409, "Change the designated COD before removing the COD role or deactivating this account");
	}
	const disablingLecturer = currentRoles.includes("lecturer") && (!nextRoles.includes("lecturer") || !nextIsActive);
	if (disablingLecturer) {
		const profile = await tx.lecturerProfile.findUnique({ where: { userId }, select: { _count: { select: { unitAssignments: true, assignedReports: true, attendanceSessions: true } } } });
		if (profile && Object.values(profile._count).some((count) => count > 0)) {
			throw new AppError(409, "Reassign or resolve this lecturer's academic responsibilities before changing the lecturer role or deactivating the account");
		}
	}
}

export async function listAdminUsers({ db = prisma, page = 1, limit = 10, search, role, approvalStatus, isActive }) {
	const where = {
		...(role ? { roles: { some: { role: { name: role } } } } : {}),
		...(approvalStatus ? { approvalStatus } : {}),
		...(isActive === undefined ? {} : { isActive }),
		...(search ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { displayName: { contains: search, mode: "insensitive" } }] } : {}),
	};
	const select = {
		...userSelect,
		departmentMemberships: { select: { departmentId: true, department: { select: { id: true, name: true, code: true } } } },
	};
	const orderBy = [{ displayName: "asc" }, { email: "asc" }];
	const offset = (page - 1) * limit;
	let users;
	let total;
	if (!role) {
		const administratorWhere = { ...where, roles: { some: { role: { name: "administrator" } } } };
		const otherUsersWhere = { ...where, NOT: { roles: { some: { role: { name: "administrator" } } } } };
		const [administratorCount, userCount] = await Promise.all([
			db.user.count({ where: administratorWhere }),
			db.user.count({ where }),
		]);
		const administratorTake = Math.max(0, Math.min(limit, administratorCount - offset));
		const otherUsersSkip = Math.max(0, offset - administratorCount);
		const otherUsersTake = limit - administratorTake;
		const [administrators, otherUsers] = await Promise.all([
			administratorTake
				? db.user.findMany({ where: administratorWhere, select, orderBy, skip: offset, take: administratorTake })
				: [],
			otherUsersTake
				? db.user.findMany({ where: otherUsersWhere, select, orderBy, skip: otherUsersSkip, take: otherUsersTake })
				: [],
		]);
		users = [...administrators, ...otherUsers];
		total = userCount;
	} else {
		[users, total] = await Promise.all([
			db.user.findMany({ where, select, orderBy, skip: offset, take: limit }),
			db.user.count({ where }),
		]);
	}
	return { users: users.map(serializeUser), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getAdminUser({ db = prisma, userId }) {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: {
			...userSelect,
			departmentMemberships: { select: { department: { select: { id: true, code: true, name: true, designatedCodUserId: true } }, createdAt: true } },
			_count: { select: { auditLogs: true, reportAssignments: true, reportStatusChanges: true } },
			lecturerProfile: { select: { id: true, staffNumber: true, _count: { select: { unitAssignments: true, assignedReports: true, attendanceSessions: true } } } },
		},
	});
	if (!user) throw new AppError(404, "User not found");
	return {
		...serializeUser(user),
		departments: user.departmentMemberships.map(({ department, createdAt }) => ({ ...department, isDesignatedCod: department.designatedCodUserId === user.id, createdAt })),
		responsibilities: { auditEvents: user._count.auditLogs, reportAssignments: user._count.reportAssignments, reportStatusChanges: user._count.reportStatusChanges, ...(user.lecturerProfile ? { lecturer: user.lecturerProfile._count } : {}) },
	};
}

export async function createAdminUser({ db = prisma, actorUserId, email, password, displayName, roles, studentNumber, staffNumber, adminNumber }) {
	return db.$transaction(async (tx) => {
		const accountRoles = includeLecturerRole(roles);
		if (!accountRoles.includes("administrator") && !accountRoles.includes("cod")) {
			throw new AppError(422, "Only administrator and COD accounts can be created here");
		}
		const roleRecords = await validateRoles(tx, accountRoles);
		const normalizedNumbers = { studentNumber: studentNumber?.toUpperCase(), staffNumber: staffNumber?.toUpperCase(), adminNumber: adminNumber?.toUpperCase() };
		validateProfileInputs({ roles: accountRoles, ...normalizedNumbers });
		const user = await tx.user.create({ data: { email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), displayName, emailVerifiedAt: new Date(), approvalStatus: "APPROVED", isActive: true } });
		await tx.userRole.createMany({ data: roleRecords.map(({ id: roleId }) => ({ userId: user.id, roleId })) });
		if (accountRoles.includes("lecturer")) await tx.lecturerProfile.create({ data: { userId: user.id, staffNumber: normalizedNumbers.staffNumber } });
		await setLoginIdentifier(tx, user.id, accountRoles, normalizedNumbers);
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_USER_CREATED", entityType: "User", entityId: user.id, metadata: { roles: accountRoles } });
		return serializeUser(await tx.user.findUnique({ where: { id: user.id }, select: userSelect }));
	});
}

export async function updateAdminUser({ db = prisma, actorUserId, userId, email, password, displayName, isActive, roles, departmentId }) {
	return db.$transaction(async (tx) => {
		const current = await tx.user.findUnique({ where: { id: userId }, select: { ...userSelect, passwordHash: true } });
		if (!current) throw new AppError(404, "User not found");
		const currentRoles = current.roles.map(({ role }) => role.name);
		if (userId === actorUserId && currentRoles.includes("administrator") && isActive === false) {
			throw new AppError(409, "Administrators cannot deactivate their own account");
		}
		const nextRoles = includeLecturerRole(roles ?? currentRoles);
		const isStaff = currentRoles.some((role) => role === "lecturer" || role === "cod");
		if (isActive === true && isStaff && current.approvalStatus !== "APPROVED") {
			throw new AppError(409, "Approve this lecturer from the Lecturer approvals page before activating the account");
		}
		await validateRoleLifecycle(tx, { userId, currentRoles, nextRoles, nextIsActive: isActive ?? current.isActive });
		if (roles?.includes("cod") && (
			currentRoles.includes("student")
			|| !currentRoles.includes("lecturer")
			|| current.approvalStatus !== "APPROVED"
			|| !current.isActive
		)) {
			throw new AppError(422, "Only an active, approved lecturer can be assigned COD responsibility");
		}
		if (roles && currentRoles.includes("student") && roles.some((role) => role !== "student")) {
			throw new AppError(422, "Student accounts cannot be changed into staff accounts");
		}
		if (roles && currentRoles.some((role) => role === "lecturer" || role === "cod") && !roles.includes("lecturer")) {
			throw new AppError(422, "Staff accounts must retain the lecturer role");
		}
		const assigningCod = (!currentRoles.includes("cod") && nextRoles.includes("cod")) || roles?.includes("cod");
		if (assigningCod && !departmentId) {
			throw new AppError(422, "Select a department before assigning COD responsibility");
		}
		if (departmentId && nextRoles.includes("cod")) {
			const department = await tx.department.findUnique({ where: { id: departmentId }, select: { id: true, designatedCodUserId: true } });
			if (!department) throw new AppError(404, "Department not found");
			if (department.designatedCodUserId && department.designatedCodUserId !== userId) {
				throw new AppError(409, "Each department can have only one designated COD");
			}
			const membership = await tx.departmentMembership.findUnique({ where: { userId_departmentId: { userId, departmentId } }, select: { id: true } });
			if (!membership) await tx.departmentMembership.create({ data: { userId, departmentId } });
			if (department.designatedCodUserId !== userId) {
				await tx.department.update({ where: { id: departmentId }, data: { designatedCodUserId: userId } });
			}
		}
		const currentIdentifier = current.loginIdentifiers?.[0]?.value;
		const normalizedNumbers = {
			studentNumber: current.studentProfile?.studentNumber?.toUpperCase(),
			staffNumber: (current.lecturerProfile?.staffNumber ?? (currentRoles.includes("cod") ? currentIdentifier : undefined))?.toUpperCase(),
			adminNumber: (currentRoles.includes("administrator") ? currentIdentifier : undefined)?.toUpperCase(),
		};
		validateProfileInputs({
			roles: nextRoles,
			...normalizedNumbers,
			allowMissingStaffNumber: !normalizedNumbers.staffNumber && !roles && currentRoles.some((role) => role === "lecturer" || role === "cod"),
		});
		const roleRecords = roles || nextRoles.length !== currentRoles.length
			? await validateRoles(tx, nextRoles)
			: null;
		if ((currentRoles.includes("administrator") && !nextRoles.includes("administrator")) || (current.isActive && isActive === false && currentRoles.includes("administrator"))) {
			if (await countActiveAdministrators(tx) <= 1) throw new AppError(409, "The last active administrator cannot lose administrator access");
		}
		const normalizedEmail = email?.toLowerCase();
		if (normalizedEmail && normalizedEmail !== current.email) {
			const [duplicate, pendingDuplicate] = await Promise.all([
				tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
				tx.user.findUnique({ where: { pendingEmail: normalizedEmail }, select: { id: true } }),
			]);
			if ((duplicate && duplicate.id !== userId) || (pendingDuplicate && pendingDuplicate.id !== userId)) {
				throw new AppError(409, "A user with this email already exists");
			}
		}
		const emailChanged = Boolean(normalizedEmail && normalizedEmail !== current.email);
		const now = new Date();
		const user = await tx.user.update({ where: { id: userId }, data: {
			...(normalizedEmail ? {
				email: normalizedEmail,
				...(emailChanged ? { emailVerifiedAt: now, pendingEmail: null } : {}),
			} : {}),
			...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
			...(displayName !== undefined ? { displayName } : {}),
			...(isActive !== undefined ? { isActive } : {}),
		}, select: { id: true } });
		if (emailChanged) {
			await tx.accountSecurityToken.updateMany({
				where: { userId, type: { in: ["EMAIL_CHANGE", "EMAIL_VERIFICATION"] }, usedAt: null },
				data: { usedAt: now },
			});
		}
		if (roleRecords) {
			await tx.userRole.deleteMany({ where: { userId } });
			await tx.userRole.createMany({ data: roleRecords.map(({ id: roleId }) => ({ userId, roleId })) });
		}
		if (nextRoles.includes("lecturer") && normalizedNumbers.staffNumber && !current.lecturerProfile) {
			await tx.lecturerProfile.upsert({
				where: { userId },
				update: {},
				create: { userId, staffNumber: normalizedNumbers.staffNumber },
			});
		}
		if (roles) await setLoginIdentifier(tx, userId, nextRoles, normalizedNumbers);
		const changedFields = Object.entries({ email, password, displayName, isActive, roles, departmentId }).filter(([, value]) => value !== undefined).map(([key]) => key);
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_USER_UPDATED", entityType: "User", entityId: userId, metadata: { changedFields, roles: nextRoles, isActive: isActive ?? current.isActive, departmentId } });
		return serializeUser(await tx.user.findUnique({ where: { id: user.id }, select: userSelect }));
	});
}

export async function listPendingStaffAccounts({ db = prisma }) {
	const users = await db.user.findMany({
		where: {
			approvalStatus: "PENDING",
			roles: { some: { role: { name: "lecturer" } } },
			departmentMemberships: { some: {} },
		},
		select: {
			...userSelect,
			departmentMemberships: { select: { department: { select: { id: true, name: true, code: true } } } },
		},
		orderBy: { createdAt: "asc" },
	});
	return users.map(serializeUser);
}

export async function listPendingDepartmentLecturers({ db = prisma, userId }) {
	const users = await db.user.findMany({
		where: {
			approvalStatus: "PENDING",
			roles: { some: { role: { name: "lecturer" } } },
			departmentMemberships: { some: { department: { designatedCodUserId: userId } } },
		},
		select: {
			...userSelect,
			departmentMemberships: { select: { department: { select: { id: true, name: true, code: true, designatedCodUserId: true } } } },
		},
		orderBy: { createdAt: "asc" },
	});
	return users.map(serializeUser);
}

async function decidePendingLecturer({ tx, actorUserId, userId, status, codApproval = false }) {
	const user = await tx.user.findUnique({
		where: { id: userId },
		select: {
			...userSelect,
			departmentMemberships: { select: { department: { select: { id: true, name: true, designatedCodUserId: true } } } },
		},
	});
	if (!user) throw new AppError(404, "User not found");
	const currentRoles = user.roles.map(({ role }) => role.name);
	if (user.approvalStatus !== "PENDING" || !currentRoles.includes("lecturer") || currentRoles.includes("cod")) {
		throw new AppError(409, "This account is not awaiting lecturer approval");
	}
	if (user.departmentMemberships.length !== 1) {
		throw new AppError(409, "The lecturer must complete department registration before approval");
	}
	const department = user.departmentMemberships[0].department;
	if (codApproval) {
		const designatedCod = await tx.user.findFirst({
			where: {
				id: actorUserId,
				isActive: true,
				roles: { some: { role: { name: "cod" } } },
				departmentMemberships: { some: { departmentId: department.id } },
			},
			select: { id: true },
		});
		if (!designatedCod || department.designatedCodUserId !== actorUserId) {
			throw new AppError(403, "Only this department's designated COD can decide the lecturer application");
		}
	}
	if (status === "REJECTED") {
		await tx.lecturerProfile.deleteMany({ where: { userId } });
		await recordAuditEvent({
			prismaClient: tx,
			actorId: actorUserId,
			action: `${codApproval ? "COD" : "ADMIN"}_STAFF_ACCOUNT_REJECTED`,
			entityType: "User",
			entityId: userId,
			metadata: { departmentId: department.id, emailVerified: Boolean(user.emailVerifiedAt), accountDeleted: true },
		});
		await tx.user.delete({ where: { id: userId } });
		return { id: userId, approvalStatus: status, deleted: true };
	}
	await tx.user.update({ where: { id: userId }, data: { approvalStatus: status, isActive: true } });
	await recordAuditEvent({
		prismaClient: tx,
		actorId: actorUserId,
		action: `${codApproval ? "COD" : "ADMIN"}_STAFF_ACCOUNT_APPROVED`,
		entityType: "User",
		entityId: userId,
		metadata: { roles: ["lecturer"], departmentId: department.id, emailVerified: Boolean(user.emailVerifiedAt) },
	});
	return serializeUser(await tx.user.findUnique({ where: { id: userId }, select: userSelect }));
}

export async function decideStaffAccount({ db = prisma, actorUserId, userId, status }) {
	return db.$transaction((tx) => decidePendingLecturer({ tx, actorUserId, userId, status }));
}

export async function decideDepartmentLecturerAccount({ db = prisma, actorUserId, userId, status }) {
	return db.$transaction((tx) => decidePendingLecturer({ tx, actorUserId, userId, status, codApproval: true }));
}

export async function importStudentRoster({ db = prisma, actorUserId, students }) {
	const normalizedStudents = students.map(({ studentNumber, email }) => ({ studentNumber: studentNumber.trim().toUpperCase(), email: email.trim().toLowerCase() }));
	return db.$transaction(async (tx) => {
		for (const student of normalizedStudents) {
			const existing = await tx.studentRegistrationEligibility.findUnique({ where: { studentNumber: student.studentNumber } });
			if (existing?.linkedUserId) throw new AppError(409, `Student number ${student.studentNumber} is already linked to an account`);
			const rosterEmailOwner = await tx.studentRegistrationEligibility.findFirst({ where: { email: student.email, studentNumber: { not: student.studentNumber } }, select: { id: true } });
			if (rosterEmailOwner) throw new AppError(409, "A roster email is already assigned to another student number");
			const emailOwner = await tx.user.findUnique({ where: { email: student.email }, select: { studentProfile: { select: { studentNumber: true } } } });
			if (emailOwner && emailOwner.studentProfile?.studentNumber !== student.studentNumber) throw new AppError(409, "A roster email is already associated with another account");
			if (existing) await tx.studentRegistrationEligibility.update({ where: { id: existing.id }, data: { email: student.email } });
			else await tx.studentRegistrationEligibility.create({ data: student });
		}
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_STUDENT_ROSTER_IMPORTED", entityType: "StudentRegistrationEligibility", metadata: { count: normalizedStudents.length } });
		return { imported: normalizedStudents.length };
	});
}