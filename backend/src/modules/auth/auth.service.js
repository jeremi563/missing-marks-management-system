import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";
import { logger } from "../../shared/utils/logger.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { isActiveCodDepartmentMember } from "../../shared/services/designated-cod-authorization.service.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../../shared/services/email.service.js";
import {
	isStaffRegistrationNumber,
	isStudentRegistrationNumber,
	normalizeRegistrationNumber,
	parseStudentRegistrationNumber,
} from "../../shared/utils/registration-number.js";

const normalizeEmail = (value) => value.trim().toLowerCase();
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const SESSION_DURATION = "15m";

function createSessionToken(userId, roles) {
	const token = jwt.sign({ roles }, env.JWT_SECRET, { subject: userId, expiresIn: SESSION_DURATION });
	const { exp } = jwt.decode(token);
	return { token, sessionExpiresAt: new Date(exp * 1000).toISOString() };
}

async function attemptEmailDelivery(send, email, token, purpose) {
	try { await send(email, token); }
	catch (error) {
		logger.warn("Account email delivery failed", { purpose, errorName: error.name, errorCode: error.code, errorStatusCode: error.statusCode });
		return false;
	}
	return true;
}

async function storeSecurityToken(tx, userId, type, expiresInMs) {
	const token = randomBytes(32).toString("base64url");
	const now = new Date();
	await tx.accountSecurityToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } });
	await tx.accountSecurityToken.create({
		data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + expiresInMs) },
	});
	return token;
}

export async function loginWithCredentials(identifier, password, db = prisma) {
	const normalizedIdentifier = identifier.trim();
	const identifierRecord = await db.accountLoginIdentifier.findUnique({
		where: { value: normalizeRegistrationNumber(normalizedIdentifier) },
		include: { user: { include: { roles: { include: { role: true } } } } },
	});
	let user = identifierRecord?.user;
	let provisionedFromRoster = false;
	if (!user && isStudentRegistrationNumber(normalizedIdentifier)) {
		user = await provisionStudentFromRoster(normalizeRegistrationNumber(normalizedIdentifier), password, db);
		provisionedFromRoster = Boolean(user);
	}
	const roles = user?.roles.map(({ role }) => role.name) ?? [];
	const isStaff = roles.some((role) => role === "lecturer" || role === "cod");
	const isPendingLecturer = roles.includes("lecturer") && user?.approvalStatus === "PENDING" && !user?.isActive;
	const isApprovedUser = user?.isActive && user.approvalStatus === "APPROVED";

	const passwordToVerify = provisionedFromRoster ? normalizeRegistrationNumber(password) : password;
	if (!user || !(isApprovedUser || isPendingLecturer) || (!isStaff && !user.emailVerifiedAt) || !(await bcrypt.compare(passwordToVerify, user.passwordHash))) {
		throw new AppError(401, "Invalid identifier or password");
	}

	return {
		...createSessionToken(user.id, roles),
		user: {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
			approvalStatus: user.approvalStatus,
			isActive: user.isActive,
			mustChangePassword: user.mustChangePassword,
			roles,
		},
	};
}

async function provisionStudentFromRoster(identifier, password, db) {
	if (normalizeRegistrationNumber(password) !== identifier) return null;
	const registration = parseStudentRegistrationNumber(identifier);
	if (!registration) return null;

	return db.$transaction(async (tx) => {
		const eligibility = await tx.studentRegistrationEligibility.findUnique({
			where: { studentNumber: identifier },
		});
		if (!eligibility || eligibility.linkedUserId) return null;
		const course = await tx.course.findFirst({
			where: {
				code: registration.courseCode,
				department: { initials: registration.departmentInitials },
			},
			select: { id: true },
		});
		if (!course) throw new AppError(422, "Your registration record is incomplete. Contact the administrator.");
		const existingEmail = await tx.user.findUnique({
			where: { email: normalizeEmail(eligibility.email) },
			select: { id: true },
		});
		if (existingEmail) return null;

		const passwordHash = await bcrypt.hash(identifier, 12);
		const role = await tx.role.upsert({
			where: { name: "student" },
			update: {},
			create: { name: "student" },
		});
		const now = new Date();
		const user = await tx.user.create({
			data: {
				email: normalizeEmail(eligibility.email),
				passwordHash,
				displayName: null,
				mustChangePassword: true,
				isActive: true,
				approvalStatus: "APPROVED",
				emailVerifiedAt: now,
			},
		});
		await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
		await tx.accountLoginIdentifier.create({
			data: { userId: user.id, type: "STUDENT_NUMBER", value: identifier },
		});
		await tx.studentProfile.create({
			data: {
				userId: user.id,
				studentNumber: identifier,
				officialEmail: eligibility.email,
			},
		});
		const linkResult = await tx.studentRegistrationEligibility.updateMany({
			where: { id: eligibility.id, linkedUserId: null },
			data: { linkedUserId: user.id },
		});
		if (linkResult.count !== 1) throw new AppError(409, "This student account was created by another sign-in. Please try again.");
		return {
			...user,
			roles: [{ role }],
		};
	});
}

export function extendSession(user) {
	return createSessionToken(user.id, user.roles);
}

export async function registerAccount({ email, password, displayName, registrationNumber }, db = prisma) {
	const normalizedEmail = normalizeEmail(email);
	const identifier = normalizeRegistrationNumber(registrationNumber);
	if (isStudentRegistrationNumber(identifier)) {
		throw new AppError(403, "Students sign in with their roster registration number and temporary password; account registration is disabled.");
	}
	if (!isStaffRegistrationNumber(identifier)) throw new AppError(422, "Registration details could not be verified");
	await db.$transaction(async (tx) => {
		if (await tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) {
			throw new AppError(409, "An account with these details already exists");
		}
		if (await tx.user.findUnique({ where: { pendingEmail: normalizedEmail }, select: { id: true } })) {
			throw new AppError(409, "An account with these details already exists");
		}
		if (await tx.accountLoginIdentifier.findUnique({ where: { value: identifier }, select: { id: true } })) {
			throw new AppError(409, "An account with these details already exists");
		}

		const roleRecord = await tx.role.upsert({ where: { name: "lecturer" }, update: {}, create: { name: "lecturer" } });
		const user = await tx.user.create({ data: {
			email: normalizedEmail,
			passwordHash: await bcrypt.hash(password, 12),
			displayName,
			isActive: false,
			approvalStatus: "PENDING",
		} });
		await tx.userRole.create({ data: { userId: user.id, roleId: roleRecord.id } });
		await tx.accountLoginIdentifier.create({ data: {
			userId: user.id,
			type: "STAFF_NUMBER",
			value: identifier,
		} });
		await tx.lecturerProfile.create({ data: { userId: user.id, staffNumber: identifier } });
	});

	return {
		status: "PENDING_DEPARTMENT_REGISTRATION",
		verificationEmailSent: false,
		requiresEmailVerification: false,
		requiresDepartmentRegistration: true,
	};
}

export async function listRegistrationDepartments(db = prisma) {
	return db.department.findMany({
		select: { id: true, name: true, code: true },
		orderBy: [{ name: "asc" }, { code: "asc" }],
	});
}

export async function completeLecturerDepartmentRegistration({
	email,
	password,
	displayName,
	registrationNumber,
	departmentIds,
	primaryDepartmentId,
}, db = prisma) {
	const normalizedEmail = normalizeEmail(email);
	const normalizedIdentifier = normalizeRegistrationNumber(registrationNumber);
	return db.$transaction(async (tx) => {
		const user = await tx.user.findUnique({
			where: { email: normalizedEmail },
			select: {
				id: true,
				email: true,
				displayName: true,
				passwordHash: true,
				isActive: true,
				approvalStatus: true,
				roles: { select: { role: { select: { name: true } } } },
				loginIdentifiers: { select: { type: true, value: true } },
				departmentMemberships: { select: { departmentId: true } },
			},
		});
		const matchesRegistration = user
			&& user.displayName?.trim().toLowerCase() === displayName.trim().toLowerCase()
			&& user.loginIdentifiers.some(({ type, value }) => type === "STAFF_NUMBER" && value === normalizedIdentifier)
			&& user.roles.some(({ role }) => role.name === "lecturer");
		if (!matchesRegistration || !(await bcrypt.compare(password, user.passwordHash))) {
			throw new AppError(422, "Lecturer registration details could not be verified");
		}
		if (user.isActive || user.approvalStatus !== "PENDING") {
			throw new AppError(409, "This lecturer account is no longer awaiting department registration");
		}
		if (user.departmentMemberships.length) {
			throw new AppError(409, "A department has already been selected for this lecturer account");
		}
		if (!departmentIds.length || new Set(departmentIds).size !== departmentIds.length
			|| !departmentIds.includes(primaryDepartmentId)) {
			throw new AppError(422, "Select a primary department from your unique department selections");
		}
		const departments = await tx.department.findMany({
			where: { id: { in: departmentIds } },
			select: { id: true, name: true, code: true, designatedCodUserId: true },
		});
		if (departments.length !== departmentIds.length) throw new AppError(422, "Select only existing departments");
		for (const department of departments) {
			if (!department.designatedCodUserId
				|| !await isActiveCodDepartmentMember(tx, department.designatedCodUserId, department.id)) {
				throw new AppError(409, `${department.name} does not have an active designated COD`);
			}
		}
		const primaryDepartment = departments.find(({ id }) => id === primaryDepartmentId);
		await tx.departmentMembership.create({ data: { userId: user.id, departmentId: primaryDepartmentId } });
		const additionalDepartments = [];
		for (const department of departments) {
			if (department.id === primaryDepartmentId) continue;
			const request = await tx.departmentMembershipRequest.create({
				data: { lecturerUserId: user.id, departmentId: department.id },
				select: { id: true, departmentId: true, status: true },
			});
			await tx.notification.create({
				data: {
					userId: department.designatedCodUserId,
					title: "Lecturer department request",
					message: `A lecturer requested membership in ${department.name} during registration.`,
				},
			});
			await recordAuditEvent({
				prismaClient: tx,
				actorId: user.id,
				action: "LECTURER_DEPARTMENT_MEMBERSHIP_REQUESTED",
				entityType: "DepartmentMembershipRequest",
				entityId: request.id,
				metadata: { departmentId: department.id, source: "LECTURER_REGISTRATION" },
			});
			const { designatedCodUserId, ...registrationDepartment } = department;
			additionalDepartments.push({ ...registrationDepartment, requestStatus: request.status });
		}
		const { designatedCodUserId, ...registrationDepartment } = primaryDepartment;
		return {
			status: "PENDING_COD_APPROVAL",
			department: registrationDepartment,
			additionalDepartments,
		};
	});
}

export async function requestEmailVerification(email, db = prisma) {
	const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
	if (!user || user.emailVerifiedAt) return;
	const token = await db.$transaction((tx) => storeSecurityToken(tx, user.id, "EMAIL_VERIFICATION", 24 * 60 * 60 * 1000));
	await attemptEmailDelivery(sendVerificationEmail, user.email, token, "verification");
}

export async function verifyEmailAddress(token, db = prisma) {
	const now = new Date();
	return db.$transaction(async (tx) => {
		const record = await tx.accountSecurityToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
		if (!record || !["EMAIL_VERIFICATION", "EMAIL_CHANGE"].includes(record.type) || record.usedAt || record.expiresAt <= now) {
			throw new AppError(400, "Verification link is invalid or expired");
		}
		const claimed = await tx.accountSecurityToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
		if (claimed.count !== 1) throw new AppError(400, "Verification link is invalid or expired");
		const emailChange = record.type === "EMAIL_CHANGE";
		if (emailChange && !record.user.pendingEmail) throw new AppError(400, "Verification link is invalid or expired");
		let updatedUser;
		try {
			updatedUser = await tx.user.update({
				where: { id: record.userId },
				data: {
					...(emailChange ? { email: record.user.pendingEmail, pendingEmail: null } : {}),
					emailVerifiedAt: now,
					isActive: record.user.approvalStatus === "APPROVED",
				},
				select: { email: true },
			});
		} catch (error) {
			if (emailChange && error.code === "P2002") throw new AppError(409, "This email address is no longer available");
			throw error;
		}
		if (emailChange) {
			await tx.accountSecurityToken.updateMany({ where: { userId: record.userId, type: "EMAIL_CHANGE", usedAt: null }, data: { usedAt: now } });
		}
		return {
			status: record.user.approvalStatus === "APPROVED" ? "APPROVED" : record.user.approvalStatus,
			...(emailChange ? { email: updatedUser.email } : {}),
		};
	});
}

export async function requestEmailChange(userId, email, currentPassword, db = prisma, send = sendVerificationEmail) {
	const normalizedEmail = normalizeEmail(email);
	const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true } });
	if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
		throw new AppError(401, "Current password is incorrect");
	}
	if (normalizedEmail === user.email) throw new AppError(422, "Enter a different email address");
	const [existingEmail, existingPendingEmail] = await Promise.all([
		db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
		db.user.findUnique({ where: { pendingEmail: normalizedEmail }, select: { id: true } }),
	]);
	if ((existingEmail && existingEmail.id !== userId) || (existingPendingEmail && existingPendingEmail.id !== userId)) {
		throw new AppError(409, "This email address is already associated with an account");
	}

	let token;
	try {
		token = await db.$transaction(async (tx) => {
			await tx.user.update({ where: { id: userId }, data: { pendingEmail: normalizedEmail } });
			return storeSecurityToken(tx, userId, "EMAIL_CHANGE", 24 * 60 * 60 * 1000);
		});
	} catch (error) {
		if (error.code === "P2002") throw new AppError(409, "This email address is already associated with an account");
		throw error;
	}
	const verificationEmailSent = await attemptEmailDelivery(send, normalizedEmail, token, "email_change");
	return { pendingEmail: normalizedEmail, verificationEmailSent };
}

export async function requestPasswordReset(email, db = prisma) {
	const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
	if (!user?.emailVerifiedAt || !user.isActive) return;
	const token = await db.$transaction((tx) => storeSecurityToken(tx, user.id, "PASSWORD_RESET", 60 * 60 * 1000));
	await attemptEmailDelivery(sendPasswordResetEmail, user.email, token, "password_reset");
}

export async function resetPassword(token, password, db = prisma) {
	const now = new Date();
	const passwordHash = await bcrypt.hash(password, 12);
	await db.$transaction(async (tx) => {
		const record = await tx.accountSecurityToken.findUnique({ where: { tokenHash: hashToken(token) } });
		if (!record || record.type !== "PASSWORD_RESET" || record.usedAt || record.expiresAt <= now) {
			throw new AppError(400, "Password reset link is invalid or expired");
		}
		const claimed = await tx.accountSecurityToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
		if (claimed.count !== 1) throw new AppError(400, "Password reset link is invalid or expired");
		await tx.user.update({ where: { id: record.userId }, data: { passwordHash, mustChangePassword: false } });
		await tx.accountSecurityToken.updateMany({ where: { userId: record.userId, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: now } });
	});
}

export async function changePassword(userId, currentPassword, newPassword, db = prisma) {
	const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
	if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
		throw new AppError(401, "Current password is incorrect");
	}
	const passwordHash = await bcrypt.hash(newPassword, 12);
	await db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
}

export async function updateAvatar(userId, avatarData, db = prisma) {
	if (avatarData !== null) {
		const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatarData);
		if (!match) throw new AppError(422, "Choose a JPEG, PNG, or WebP image no larger than 512 KB");
		const [, imageType, encodedImage] = match;
		const image = Buffer.from(encodedImage, "base64");
		const validSignature = imageType === "png"
			? image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
			: imageType === "jpeg"
				? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
				: image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP";
		if (!image.length || image.length > 512 * 1024 || image.toString("base64") !== encodedImage || !validSignature) {
			throw new AppError(422, "Choose a valid JPEG, PNG, or WebP image no larger than 512 KB");
		}
	}
	const user = await db.user.update({ where: { id: userId }, data: { avatarData }, select: { avatarData: true } });
	return { avatarData: user.avatarData };
}
