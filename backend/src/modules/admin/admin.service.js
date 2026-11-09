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

async function validateRoles(tx, roles) {
	const requestedRoles = [...new Set(roles)];
	const roleRecords = await tx.role.findMany({ where: { name: { in: requestedRoles } }, select: { id: true, name: true } });
	if (roleRecords.length !== requestedRoles.length) throw new AppError(422, "One or more requested roles do not exist");
	return roleRecords;
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

export async function listAdminUsers({ db = prisma, page = 1, limit = 10, search, role, isActive }) {
	const where = {
		...(role ? { roles: { some: { role: { name: role } } } } : {}),
		...(isActive === undefined ? {} : { isActive }),
		...(search ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { displayName: { contains: search, mode: "insensitive" } }] } : {}),
	};
	const [users, total] = await Promise.all([
		db.user.findMany({ where, select: userSelect, orderBy: [{ displayName: "asc" }, { email: "asc" }], skip: (page - 1) * limit, take: limit }),
		db.user.count({ where }),
	]);
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
		const roleRecords = await validateRoles(tx, roles);
		const normalizedNumbers = { studentNumber: studentNumber?.toUpperCase(), staffNumber: staffNumber?.toUpperCase(), adminNumber: adminNumber?.toUpperCase() };
		validateProfileInputs({ roles, ...normalizedNumbers });
		const user = await tx.user.create({ data: { email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), displayName, emailVerifiedAt: new Date(), approvalStatus: "APPROVED", isActive: true } });
		await tx.userRole.createMany({ data: roleRecords.map(({ id: roleId }) => ({ userId: user.id, roleId })) });
		if (roles.includes("student")) await tx.studentProfile.create({ data: { userId: user.id, studentNumber: normalizedNumbers.studentNumber } });
		if (roles.includes("lecturer")) await tx.lecturerProfile.create({ data: { userId: user.id, staffNumber: normalizedNumbers.staffNumber } });
		await setLoginIdentifier(tx, user.id, roles, normalizedNumbers);
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_USER_CREATED", entityType: "User", entityId: user.id, metadata: { roles } });
		return serializeUser(await tx.user.findUnique({ where: { id: user.id }, select: userSelect }));
	});
}

export async function updateAdminUser({ db = prisma, actorUserId, userId, email, password, displayName, isActive, roles, studentNumber, staffNumber, adminNumber }) {
	return db.$transaction(async (tx) => {
		const current = await tx.user.findUnique({ where: { id: userId }, select: { ...userSelect, passwordHash: true } });
		if (!current) throw new AppError(404, "User not found");
		const currentRoles = current.roles.map(({ role }) => role.name);
		const nextRoles = roles ?? currentRoles;
		const currentIdentifier = current.loginIdentifiers?.[0]?.value;
		const normalizedNumbers = {
			studentNumber: (studentNumber ?? current.studentProfile?.studentNumber)?.toUpperCase(),
			staffNumber: (staffNumber ?? current.lecturerProfile?.staffNumber ?? (currentRoles.includes("cod") ? currentIdentifier : undefined))?.toUpperCase(),
			adminNumber: (adminNumber ?? (currentRoles.includes("administrator") ? currentIdentifier : undefined))?.toUpperCase(),
		};
		await validateRoleLifecycle(tx, { userId, currentRoles, nextRoles, nextIsActive: isActive ?? current.isActive });
		validateProfileInputs({
			roles: nextRoles,
			...normalizedNumbers,
			allowMissingStaffNumber: !normalizedNumbers.staffNumber && !roles && !staffNumber && currentRoles.some((role) => role === "lecturer" || role === "cod"),
		});
		const roleRecords = roles ? await validateRoles(tx, roles) : null;
		if ((currentRoles.includes("administrator") && !nextRoles.includes("administrator")) || (current.isActive && isActive === false && currentRoles.includes("administrator"))) {
			if (await countActiveAdministrators(tx) <= 1) throw new AppError(409, "The last active administrator cannot lose administrator access");
		}
		const normalizedEmail = email?.toLowerCase();
		if (normalizedEmail && normalizedEmail !== current.email) {
			const duplicate = await tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
			if (duplicate && duplicate.id !== userId) throw new AppError(409, "A user with this email already exists");
		}
		const user = await tx.user.update({ where: { id: userId }, data: {
			...(normalizedEmail ? { email: normalizedEmail } : {}),
			...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
			...(displayName !== undefined ? { displayName } : {}),
			...(isActive !== undefined ? { isActive } : {}),
		}, select: { id: true } });
		if (roleRecords) {
			await tx.userRole.deleteMany({ where: { userId } });
			await tx.userRole.createMany({ data: roleRecords.map(({ id: roleId }) => ({ userId, roleId })) });
		}
		if (studentNumber !== undefined && nextRoles.includes("student")) await tx.studentProfile.upsert({ where: { userId }, update: { studentNumber: normalizedNumbers.studentNumber }, create: { userId, studentNumber: normalizedNumbers.studentNumber } });
		if (staffNumber !== undefined && nextRoles.includes("lecturer")) await tx.lecturerProfile.upsert({ where: { userId }, update: { staffNumber: normalizedNumbers.staffNumber }, create: { userId, staffNumber: normalizedNumbers.staffNumber } });
		if (roles || studentNumber !== undefined || staffNumber !== undefined || adminNumber !== undefined) await setLoginIdentifier(tx, userId, nextRoles, normalizedNumbers);
		const changedFields = Object.entries({ email, password, displayName, isActive, roles, studentNumber, staffNumber, adminNumber }).filter(([, value]) => value !== undefined).map(([key]) => key);
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_USER_UPDATED", entityType: "User", entityId: userId, metadata: { changedFields, roles: nextRoles, isActive: isActive ?? current.isActive } });
		return serializeUser(await tx.user.findUnique({ where: { id: user.id }, select: userSelect }));
	});
}

export async function listPendingStaffAccounts({ db = prisma }) {
	const users = await db.user.findMany({
		where: { approvalStatus: "PENDING", roles: { some: { role: { name: { in: ["lecturer", "cod"] } } } } },
		select: userSelect,
		orderBy: { createdAt: "asc" },
	});
	return users.map(serializeUser);
}

export async function decideStaffAccount({ db = prisma, actorUserId, userId, status, roles }) {
	return db.$transaction(async (tx) => {
		const user = await tx.user.findUnique({ where: { id: userId }, select: { ...userSelect, emailVerifiedAt: true } });
		if (!user) throw new AppError(404, "User not found");
		const currentRoles = user.roles.map(({ role }) => role.name);
		if (user.approvalStatus !== "PENDING" || !currentRoles.some((role) => role === "lecturer" || role === "cod")) {
			throw new AppError(409, "This account is not awaiting staff approval");
		}
		const nextRoles = roles ?? currentRoles;
		if (!nextRoles.length || nextRoles.some((role) => role !== "lecturer" && role !== "cod")) throw new AppError(422, "Approval can assign lecturer and/or COD roles only");
		const roleRecords = await validateRoles(tx, nextRoles);
		await tx.userRole.deleteMany({ where: { userId } });
		await tx.userRole.createMany({ data: roleRecords.map(({ id: roleId }) => ({ userId, roleId })) });
		if (nextRoles.includes("lecturer") && !user.lecturerProfile) {
			const staffIdentifier = user.loginIdentifiers.find(({ type }) => type === "STAFF_NUMBER")?.value;
			await tx.lecturerProfile.create({ data: { userId, staffNumber: staffIdentifier } });
		}
		const isActive = status === "APPROVED" && Boolean(user.emailVerifiedAt);
		await tx.user.update({ where: { id: userId }, data: { approvalStatus: status, isActive } });
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: `ADMIN_STAFF_ACCOUNT_${status}`, entityType: "User", entityId: userId, metadata: { roles: nextRoles, emailVerified: Boolean(user.emailVerifiedAt) } });
		return serializeUser(await tx.user.findUnique({ where: { id: userId }, select: userSelect }));
	});
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