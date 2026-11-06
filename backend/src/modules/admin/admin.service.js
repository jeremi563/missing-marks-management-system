import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { AppError } from "../../shared/utils/app-error.js";

const userSelect = {
	id: true,
	email: true,
	displayName: true,
	isActive: true,
	createdAt: true,
	updatedAt: true,
	roles: { select: { role: { select: { name: true } } } },
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

function validateProfileInputs({ roles, studentNumber, staffNumber }) {
	if (roles.includes("student") && !studentNumber) throw new AppError(422, "Student accounts require a student number");
	if (roles.includes("lecturer") && !staffNumber) throw new AppError(422, "Lecturer accounts require a staff number");
	if (studentNumber && !roles.includes("student")) throw new AppError(422, "Student number requires the student role");
	if (staffNumber && !roles.includes("lecturer")) throw new AppError(422, "Staff number requires the lecturer role");
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

export async function createAdminUser({ db = prisma, actorUserId, email, password, displayName, roles, studentNumber, staffNumber }) {
	return db.$transaction(async (tx) => {
		const roleRecords = await validateRoles(tx, roles);
		validateProfileInputs({ roles, studentNumber, staffNumber });
		const user = await tx.user.create({ data: { email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), displayName } });
		await tx.userRole.createMany({ data: roleRecords.map(({ id: roleId }) => ({ userId: user.id, roleId })) });
		if (roles.includes("student")) await tx.studentProfile.create({ data: { userId: user.id, studentNumber } });
		if (roles.includes("lecturer")) await tx.lecturerProfile.create({ data: { userId: user.id, staffNumber } });
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_USER_CREATED", entityType: "User", entityId: user.id, metadata: { roles } });
		return serializeUser(await tx.user.findUnique({ where: { id: user.id }, select: userSelect }));
	});
}

export async function updateAdminUser({ db = prisma, actorUserId, userId, email, password, displayName, isActive, roles, studentNumber, staffNumber }) {
	return db.$transaction(async (tx) => {
		const current = await tx.user.findUnique({ where: { id: userId }, select: { ...userSelect, passwordHash: true } });
		if (!current) throw new AppError(404, "User not found");
		const currentRoles = current.roles.map(({ role }) => role.name);
		const nextRoles = roles ?? currentRoles;
		validateProfileInputs({ roles: nextRoles, studentNumber: studentNumber ?? current.studentProfile?.studentNumber, staffNumber: staffNumber ?? current.lecturerProfile?.staffNumber });
		await validateRoleLifecycle(tx, { userId, currentRoles, nextRoles, nextIsActive: isActive ?? current.isActive });
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
		if (studentNumber !== undefined) await tx.studentProfile.upsert({ where: { userId }, update: { studentNumber }, create: { userId, studentNumber } });
		if (staffNumber !== undefined) await tx.lecturerProfile.upsert({ where: { userId }, update: { staffNumber }, create: { userId, staffNumber } });
		const changedFields = Object.entries({ email, password, displayName, isActive, roles, studentNumber, staffNumber }).filter(([, value]) => value !== undefined).map(([key]) => key);
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_USER_UPDATED", entityType: "User", entityId: userId, metadata: { changedFields, roles: nextRoles, isActive: isActive ?? current.isActive } });
		return serializeUser(await tx.user.findUnique({ where: { id: user.id }, select: userSelect }));
	});
}