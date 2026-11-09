import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";
import { logger } from "../../shared/utils/logger.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../../shared/services/email.service.js";

const normalizeIdentifier = (value) => value.trim().toUpperCase();
const normalizeEmail = (value) => value.trim().toLowerCase();
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

async function attemptEmailDelivery(send, email, token, purpose) {
	try { await send(email, token); }
	catch (error) { logger.warn("Account email delivery failed", { purpose, errorCode: error.code }); }
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
		where: { value: normalizeIdentifier(normalizedIdentifier) },
		include: { user: { include: { roles: { include: { role: true } } } } },
	});
	const user = identifierRecord?.user ?? (normalizedIdentifier.includes("@")
		? await db.user.findUnique({ where: { email: normalizeEmail(normalizedIdentifier) }, include: { roles: { include: { role: true } } } })
		: null);

	if (!user || !user.isActive || user.approvalStatus !== "APPROVED" || !user.emailVerifiedAt || !(await bcrypt.compare(password, user.passwordHash))) {
		throw new AppError(401, "Invalid identifier or password");
	}

	const roles = user.roles.map(({ role }) => role.name);
	const token = jwt.sign({ roles }, env.JWT_SECRET, { subject: user.id, expiresIn: "15m" });
	return { token, user: { id: user.id, email: user.email, displayName: user.displayName, roles } };
}

export async function registerAccount({ role, email, password, displayName, studentNumber, staffNumber }, db = prisma, deliverVerification = sendVerificationEmail) {
	const normalizedEmail = normalizeEmail(email);
	const identifier = normalizeIdentifier(role === "student" ? studentNumber : staffNumber);
	const token = await db.$transaction(async (tx) => {
		if (await tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) {
			throw new AppError(409, "An account with these details already exists");
		}
		if (role === "student") {
			const eligibility = await tx.studentRegistrationEligibility.findUnique({ where: { studentNumber: identifier } });
			if (!eligibility || eligibility.email !== normalizedEmail || eligibility.linkedUserId) {
				throw new AppError(422, "Registration details could not be verified");
			}
		}
		if (await tx.accountLoginIdentifier.findUnique({ where: { value: identifier }, select: { id: true } })) {
			throw new AppError(409, "An account with these details already exists");
		}

		const roleRecord = await tx.role.upsert({ where: { name: role }, update: {}, create: { name: role } });
		const user = await tx.user.create({ data: {
			email: normalizedEmail,
			passwordHash: await bcrypt.hash(password, 12),
			displayName,
			isActive: role === "student",
			approvalStatus: role === "student" ? "APPROVED" : "PENDING",
		} });
		await tx.userRole.create({ data: { userId: user.id, roleId: roleRecord.id } });
		await tx.accountLoginIdentifier.create({ data: {
			userId: user.id,
			type: role === "student" ? "STUDENT_NUMBER" : "STAFF_NUMBER",
			value: identifier,
		} });
		if (role === "student") {
			await tx.studentProfile.create({ data: { userId: user.id, studentNumber: identifier } });
			await tx.studentRegistrationEligibility.update({ where: { studentNumber: identifier }, data: { linkedUserId: user.id } });
		} else if (role === "lecturer") {
			await tx.lecturerProfile.create({ data: { userId: user.id, staffNumber: identifier } });
		}
		return storeSecurityToken(tx, user.id, "EMAIL_VERIFICATION", 24 * 60 * 60 * 1000);
	});

	await deliverVerification(normalizedEmail, token);
	return { status: role === "student" ? "PENDING_EMAIL_VERIFICATION" : "PENDING_EMAIL_AND_ADMIN_APPROVAL" };
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
		if (!record || record.type !== "EMAIL_VERIFICATION" || record.usedAt || record.expiresAt <= now) {
			throw new AppError(400, "Verification link is invalid or expired");
		}
		const claimed = await tx.accountSecurityToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
		if (claimed.count !== 1) throw new AppError(400, "Verification link is invalid or expired");
		await tx.user.update({
			where: { id: record.userId },
			data: { emailVerifiedAt: now, isActive: record.user.approvalStatus === "APPROVED" },
		});
		return { status: record.user.approvalStatus === "APPROVED" ? "APPROVED" : record.user.approvalStatus };
	});
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
		await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
		await tx.accountSecurityToken.updateMany({ where: { userId: record.userId, type: "PASSWORD_RESET", usedAt: null }, data: { usedAt: now } });
	});
}
