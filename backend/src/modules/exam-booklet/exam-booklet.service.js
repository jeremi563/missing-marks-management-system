import { createHash, randomBytes, randomUUID } from "node:crypto";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { enqueueNotificationOnce } from "../../shared/services/notification-outbox.service.js";
import { isActiveCodDepartmentMember } from "../../shared/services/designated-cod-authorization.service.js";
import { academicYearBounds, academicYearForDate } from "../../shared/utils/academic-year.js";
import { AppError } from "../../shared/utils/app-error.js";

const activeBookletStatuses = ["ALLOCATED", "VERIFIED"];

function hashToken(token) {
	return createHash("sha256").update(token).digest("hex");
}

function generateToken() {
	return randomBytes(32).toString("hex");
}

function assertExamSession(session) {
	if (!session) throw new AppError(404, "Examination session not found");
	if (
		session.sessionType !== "EXAM"
		|| session.assessment?.type?.toUpperCase() !== "EXAM"
		|| session.assessment.courseUnitId !== session.courseUnitId
	) {
		throw new AppError(409, "This is not a valid examination session");
	}
	return session;
}

function assertSessionOpen(session, now) {
	if (
		String(session.status).toLowerCase() !== "active"
		|| new Date(session.startsAt) > now
		|| (session.endsAt && new Date(session.endsAt) <= now)
	) {
		throw new AppError(409, "This examination session is not currently accepting booklet verification");
	}
}

async function getExamSession(db, sessionId) {
	return db.attendanceSession.findUnique({
		where: { id: sessionId },
		select: {
			id: true,
			courseUnitId: true,
			lecturerProfileId: true,
			assessmentId: true,
			sessionType: true,
			status: true,
			startsAt: true,
			endsAt: true,
			courseUnit: {
				select: {
					id: true,
					code: true,
					name: true,
					departmentId: true,
					department: { select: { designatedCodUserId: true } },
				},
			},
			assessment: {
				select: { id: true, code: true, name: true, type: true, courseUnitId: true },
			},
		},
	});
}

async function assertLecturerOwnsSession(db, userId, sessionId) {
	const [lecturer, rawSession] = await Promise.all([
		db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } }),
		getExamSession(db, sessionId),
	]);
	const session = assertExamSession(rawSession);
	if (!lecturer || session.lecturerProfileId !== lecturer.id) {
		throw new AppError(404, "Examination session not found");
	}
	return { lecturer, session };
}

async function assertReplacementAuthority(db, userId, role, session) {
	if (role === "lecturer") {
		const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
		if (!lecturer || lecturer.id !== session.lecturerProfileId) {
			throw new AppError(404, "Examination booklet not found");
		}
		return;
	}
	const departmentId = session.courseUnit.departmentId;
	if (
		session.courseUnit.department.designatedCodUserId !== userId
		|| !await isActiveCodDepartmentMember(db, userId, departmentId)
	) {
		throw new AppError(404, "Examination booklet not found");
	}
}

async function assertStudentEnrollment(db, studentProfileId, session) {
	const bounds = academicYearBounds(academicYearForDate(session.startsAt));
	if (!bounds) throw new AppError(409, "The examination session has no valid academic year");
	const enrollment = await db.unitEnrollment.findFirst({
		where: {
			studentProfileId,
			courseUnitId: session.courseUnitId,
			academicPeriod: {
				startsAt: { gte: bounds.startsAt, lt: bounds.endsAt },
			},
		},
		select: { id: true },
	});
	if (!enrollment) throw new AppError(403, "The student is not enrolled in this examination course unit and academic year");
	return enrollment;
}

function bookletSelect() {
	return {
		id: true,
		bookletIdentifier: true,
		studentProfileId: true,
		assessmentId: true,
		sessionId: true,
		tokenHash: true,
		retiredTokenHash: true,
		status: true,
		verifiedAt: true,
		verifiedByUserId: true,
		verificationMethod: true,
		student: { select: { id: true, studentNumber: true, user: { select: { id: true, displayName: true } } } },
		assessment: { select: { id: true, code: true, name: true, type: true } },
		session: { select: { id: true, startsAt: true, endsAt: true, status: true, sessionType: true, courseUnit: { select: { id: true, code: true, name: true } } } },
	};
}

async function recordScan(db, {
	bookletId = null,
	studentProfileId = null,
	assessmentId = null,
	sessionId = null,
	attendanceRecordId = null,
	scannerUserId,
	scannerRole,
	scanMethod,
	outcome,
	exceptionCode = null,
	exceptionDetails = null,
	occurredAt = new Date(),
}) {
	return db.examBookletScan.create({
		data: {
			bookletId,
			studentProfileId,
			assessmentId,
			sessionId,
			attendanceRecordId,
			scannerUserId,
			scannerRole,
			scanMethod,
			outcome,
			exceptionCode,
			exceptionDetails,
			occurredAt,
		},
		select: { id: true },
	});
}

async function recordRejectedScan(db, args, { code, message, statusCode = 409 }) {
	const scan = await recordScan(db, {
		...args,
		outcome: "REJECTED",
		exceptionCode: code,
		exceptionDetails: message,
	});
	await recordAuditEvent({
		prismaClient: db,
		actorId: args.scannerUserId,
		action: "EXAM_BOOKLET_SCAN_REJECTED",
		entityType: "ExamBookletScan",
		entityId: scan.id,
		metadata: { exceptionCode: code, bookletId: args.bookletId, sessionId: args.sessionId },
	});
	return { failure: { statusCode, message } };
}

function throwFailure(result) {
	if (result.failure) throw new AppError(result.failure.statusCode, result.failure.message);
	return result.data;
}

async function listEligibleEnrollments(db, session) {
	const bounds = academicYearBounds(academicYearForDate(session.startsAt));
	if (!bounds) throw new AppError(409, "The examination session has no valid academic year");
	const enrollments = await db.unitEnrollment.findMany({
		where: {
			courseUnitId: session.courseUnitId,
			academicPeriod: { startsAt: { gte: bounds.startsAt, lt: bounds.endsAt } },
		},
		select: {
			studentProfileId: true,
			student: { select: { id: true, studentNumber: true, user: { select: { displayName: true } } } },
		},
		orderBy: { studentProfileId: "asc" },
	});
	return [...new Map(enrollments.map((enrollment) => [enrollment.studentProfileId, enrollment])).values()];
}

export async function allocateExamBooklets(db, userId, sessionId) {
	const { session } = await assertLecturerOwnsSession(db, userId, sessionId);
	const enrollments = await listEligibleEnrollments(db, session);
	const studentIds = enrollments.map(({ studentProfileId }) => studentProfileId);
	const existing = studentIds.length
		? await db.examBooklet.findMany({
			where: { studentProfileId: { in: studentIds }, assessmentId: session.assessmentId, status: { in: activeBookletStatuses } },
			select: { id: true, studentProfileId: true, status: true },
		})
		: [];
	const existingIds = new Set(existing.map(({ studentProfileId }) => studentProfileId));
	const newlyAllocated = enrollments
		.filter(({ studentProfileId }) => !existingIds.has(studentProfileId))
		.map(({ studentProfileId }) => {
			const token = generateToken();
			return {
				bookletIdentifier: randomUUID(),
				studentProfileId,
				assessmentId: session.assessmentId,
				sessionId: session.id,
				tokenHash: hashToken(token),
				status: "ALLOCATED",
				_token: token,
			};
		});
	if (newlyAllocated.length) {
		await db.$transaction(async (tx) => {
			await tx.examBooklet.createMany({
				data: newlyAllocated.map(({ _token, ...row }) => row),
				skipDuplicates: true,
			});
			const hashes = newlyAllocated.map(({ tokenHash }) => tokenHash);
			const inserted = await tx.examBooklet.findMany({
				where: { tokenHash: { in: hashes } },
				select: { id: true, studentProfileId: true, bookletIdentifier: true, tokenHash: true },
			});
			if (inserted.length) {
				await recordAuditEvent({
					prismaClient: tx,
					actorId: userId,
					action: "EXAM_BOOKLETS_ALLOCATED",
					entityType: "AttendanceSession",
					entityId: session.id,
					metadata: { assessmentId: session.assessmentId, allocationCount: inserted.length },
				});
			}
		});
	}

	const [booklets, inserted] = await Promise.all([
		db.examBooklet.findMany({
			where: {
				assessmentId: session.assessmentId,
				studentProfileId: { in: studentIds },
				status: { in: activeBookletStatuses },
			},
			select: {
				id: true,
				bookletIdentifier: true,
				studentProfileId: true,
				status: true,
				student: { select: { id: true, studentNumber: true, user: { select: { displayName: true } } } },
			},
			orderBy: { studentProfileId: "asc" },
		}),
		newlyAllocated.length
			? db.examBooklet.findMany({
				where: { tokenHash: { in: newlyAllocated.map(({ tokenHash }) => tokenHash) } },
				select: { id: true, studentProfileId: true, bookletIdentifier: true, tokenHash: true },
			})
			: [],
	]);
	const tokenByStudent = new Map(newlyAllocated.map(({ studentProfileId, tokenHash, _token }) => [
		studentProfileId,
		inserted.some((row) => row.tokenHash === tokenHash) ? _token : null,
	]));
	return {
		sessionId: session.id,
		assessment: session.assessment,
		allocations: booklets.map((booklet) => ({
			id: booklet.id,
			bookletIdentifier: booklet.bookletIdentifier,
			status: booklet.status,
			student: booklet.student,
			qrToken: tokenByStudent.get(booklet.studentProfileId) ?? null,
		})),
		newlyAllocatedCount: inserted.length,
	};
}

export async function listStudentExamBooklets(db, userId) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Student profile not found");
	return db.examBooklet.findMany({
		where: { studentProfileId: student.id },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		select: {
			id: true,
			bookletIdentifier: true,
			status: true,
			verifiedAt: true,
			verificationMethod: true,
			createdAt: true,
			studentProfileId: true,
			assessment: { select: { id: true, code: true, name: true, type: true } },
			session: { select: { id: true, startsAt: true, endsAt: true, status: true, courseUnit: { select: { code: true, name: true } } } },
		},
	});
}

async function recordAttendanceVerification(tx, { session, student, userId, method, now }) {
	let record = await tx.attendanceRecord.findUnique({
		where: { sessionId_studentProfileId: { sessionId: session.id, studentProfileId: student.id } },
		select: {
			id: true,
			status: true,
			examVerificationStatus: true,
			examVerifiedByLecturerId: true,
			examVerifiedAt: true,
		},
	});
	if (record?.examVerificationStatus === "REJECTED") {
		throw new AppError(409, "This examination attendance was already rejected by its lecturer");
	}

	if (!record) {
		await tx.attendanceRecord.createMany({
			data: [{
				sessionId: session.id,
				studentProfileId: student.id,
				status: "PRESENT",
				locationVerified: false,
				recordedAt: now,
				examVerificationStatus: "VERIFIED",
				examVerificationMethod: method,
				examVerificationActorUserId: userId,
				examVerificationActorAt: now,
			}],
			skipDuplicates: true,
		});
		record = await tx.attendanceRecord.findUnique({
			where: { sessionId_studentProfileId: { sessionId: session.id, studentProfileId: student.id } },
			select: { id: true, status: true, examVerificationStatus: true, examVerifiedByLecturerId: true, examVerifiedAt: true },
		});
	}

	if (record.examVerificationStatus !== "VERIFIED") {
		const updated = await tx.attendanceRecord.updateMany({
			where: { id: record.id, examVerificationStatus: record.examVerificationStatus },
			data: {
				examVerificationStatus: "VERIFIED",
				examVerificationMethod: method,
				examVerificationActorUserId: userId,
				examVerificationActorAt: now,
			},
		});
		if (updated.count !== 1) throw new AppError(409, "Examination attendance changed during verification; retry");
	} else {
		const updated = await tx.attendanceRecord.updateMany({
			where: { id: record.id, examVerificationStatus: "VERIFIED" },
			data: {
				examVerificationMethod: method,
				examVerificationActorUserId: userId,
				examVerificationActorAt: now,
			},
		});
		if (updated.count !== 1) throw new AppError(409, "Examination attendance changed during verification; retry");
	}

	await tx.attendanceHistory.createMany({
		data: [{
			attendanceRecordId: record.id,
			studentProfileId: student.id,
			courseUnitCode: session.courseUnit.code,
			courseUnitName: session.courseUnit.name,
			sessionStartedAt: session.startsAt,
			status: record.status || "PRESENT",
			locationVerified: false,
			signedAt: now,
		}],
		skipDuplicates: true,
	});
	return record.id;
}

async function writeSuccessfulVerification(tx, { booklet, session, student, userId, scannerRole, method, now, manual = false }) {
	const attendanceRecordId = await recordAttendanceVerification(tx, { session, student, userId, method, now });
	const updated = await tx.examBooklet.updateMany({
		where: { id: booklet.id, status: "ALLOCATED", tokenHash: booklet.tokenHash },
		data: { status: "VERIFIED", verifiedAt: now, verifiedByUserId: userId, verificationMethod: method },
	});
	if (updated.count !== 1) throw new AppError(409, "This examination booklet was scanned concurrently; retry");

	const scan = await recordScan(tx, {
		bookletId: booklet.id,
		studentProfileId: student.id,
		assessmentId: session.assessmentId,
		sessionId: session.id,
		attendanceRecordId,
		scannerUserId: userId,
		scannerRole,
		scanMethod: method,
		outcome: "SUCCESS",
		exceptionCode: manual ? "DAMAGED_QR_MANUAL" : null,
		exceptionDetails: manual ? "QR was unreadable; invigilator confirmed the student and allocation manually." : null,
		occurredAt: now,
	});
	await recordAuditEvent({
		prismaClient: tx,
		actorId: userId,
		action: "EXAM_BOOKLET_VERIFIED",
		entityType: "ExamBooklet",
		entityId: booklet.id,
		metadata: {
			assessmentId: session.assessmentId,
			attendanceSessionId: session.id,
			attendanceRecordId,
			scanId: scan.id,
			scanMethod: method,
			manualLookup: manual,
		},
	});
	await enqueueNotificationOnce(tx, {
		dedupeKey: `EXAM_BOOKLET_VERIFIED:${booklet.id}`,
		eventType: "EXAM_BOOKLET_VERIFIED",
		entityType: "ExamBooklet",
		entityId: booklet.id,
		recipientUserId: student.user.id,
		title: "Examination booklet verified",
		message: `Your examination booklet for ${session.courseUnit.code} has been verified.`,
	});
	return { bookletId: booklet.id, bookletIdentifier: booklet.bookletIdentifier, status: "VERIFIED", verifiedAt: now, verificationMethod: method, attendanceRecordId, examVerificationStatus: "VERIFIED", duplicate: false };
}

async function scanWithToken(db, {
	userId,
	role,
	method,
	sessionId,
	token,
	identityConfirmed = false,
	manualStudentNumber = null,
	now = new Date(),
}) {
	const result = await db.$transaction(async (tx) => {
		let session;
		let student;
		if (role === "student") {
			student = await tx.studentProfile.findUnique({
				where: { userId },
				select: { id: true, studentNumber: true, user: { select: { id: true } } },
			});
			if (!student) throw new AppError(404, "Student profile not found");
			session = assertExamSession(await getExamSession(tx, sessionId));
		} else {
			const authorized = await assertLecturerOwnsSession(tx, userId, sessionId);
			session = authorized.session;
			if (!identityConfirmed && !manualStudentNumber) {
				throw new AppError(400, "Confirm the student's physical identity before completing booklet verification");
			}
			if (manualStudentNumber) {
				student = await tx.studentProfile.findUnique({
					where: { studentNumber: manualStudentNumber },
					select: { id: true, studentNumber: true, user: { select: { id: true } } },
				});
			}
		}

		const args = {
			scannerUserId: userId,
			scannerRole: role,
			scanMethod: method,
			studentProfileId: student?.id ?? null,
			sessionId: session.id,
			assessmentId: session.assessmentId,
			occurredAt: now,
		};
		const tokenHash = token ? hashToken(token) : null;
		let booklet = tokenHash
			? await tx.examBooklet.findFirst({
				where: { OR: [{ tokenHash }, { retiredTokenHash: tokenHash }] },
				select: bookletSelect(),
			})
			: null;

		if (manualStudentNumber && !student) {
			return recordRejectedScan(tx, args, {
				code: "MISSING_ALLOCATION",
				message: "No examination allocation was found for the confirmed student.",
				statusCode: 404,
			});
		}
		if (!booklet && manualStudentNumber && student) {
			booklet = await tx.examBooklet.findFirst({
				where: {
					studentProfileId: student.id,
					assessmentId: session.assessmentId,
					sessionId: session.id,
					status: { in: activeBookletStatuses },
				},
				select: bookletSelect(),
			});
			if (!booklet) {
				return recordRejectedScan(tx, args, {
					code: "MISSING_ALLOCATION",
					message: "No examination booklet allocation was found for the confirmed student.",
					statusCode: 404,
				});
			}
		}
		if (!booklet) {
			return recordRejectedScan(tx, args, {
				code: "INVALID_QR",
				message: "The QR code is invalid or has expired.",
				statusCode: 404,
			});
		}
		if (role === "student" && booklet.studentProfileId !== student.id) {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: student.id,
				assessmentId: booklet.assessmentId,
			}, {
				code: "WRONG_STUDENT",
				message: "This booklet is allocated to another student.",
				statusCode: 403,
			});
		}
		if (booklet.sessionId !== session.id || booklet.assessmentId !== session.assessmentId) {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
			}, {
				code: "WRONG_EXAM",
				message: "This booklet is allocated to a different examination session or assessment.",
				statusCode: 409,
			});
		}
		if (booklet.status === "REPLACED" || (tokenHash && booklet.retiredTokenHash === tokenHash)) {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
			}, {
				code: "REPLACED_BOOKLET",
				message: "This booklet QR was invalidated when the booklet was replaced.",
				statusCode: 409,
			});
		}
		if (!["ALLOCATED", "VERIFIED"].includes(booklet.status)) {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
			}, {
				code: "INACTIVE_BOOKLET",
				message: "This examination booklet is no longer active.",
				statusCode: 409,
			});
		}

		const targetStudent = role === "student" ? student : (manualStudentNumber ? student : booklet.student);
		if (role === "lecturer" && targetStudent?.id !== booklet.studentProfileId) {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: targetStudent?.id ?? null,
				assessmentId: booklet.assessmentId,
			}, {
				code: "WRONG_STUDENT",
				message: "The scanned booklet does not match the confirmed student.",
				statusCode: 409,
			});
		}
		try {
			await assertStudentEnrollment(tx, booklet.studentProfileId, session);
			assertSessionOpen(session, now);
		} catch (error) {
			if (!(error instanceof AppError)) throw error;
			const exceptionCode = error.message.includes("enrolled") ? "NOT_ENROLLED"
				: error.message.includes("session") ? "INACTIVE_SESSION" : "INVALID_SESSION";
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
			}, { code: exceptionCode, message: error.message, statusCode: error.statusCode });
		}

		if (booklet.status === "VERIFIED") {
			const scan = await recordScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
				outcome: "DUPLICATE",
				exceptionCode: "DUPLICATE_SCAN",
				exceptionDetails: "This booklet has already been verified.",
			});
			await recordAuditEvent({
				prismaClient: tx,
				actorId: userId,
				action: "EXAM_BOOKLET_DUPLICATE_SCAN",
				entityType: "ExamBookletScan",
				entityId: scan.id,
				metadata: { bookletId: booklet.id, sessionId: session.id, scanMethod: method },
			});
			return { data: { bookletId: booklet.id, bookletIdentifier: booklet.bookletIdentifier, status: "VERIFIED", verifiedAt: booklet.verifiedAt, verificationMethod: booklet.verificationMethod, examVerificationStatus: "VERIFIED", duplicate: true } };
		}

		const at = await tx.attendanceRecord.findUnique({
			where: { sessionId_studentProfileId: { sessionId: session.id, studentProfileId: booklet.studentProfileId } },
			select: { id: true, examVerificationStatus: true },
		});
		if (at?.examVerificationStatus === "REJECTED") {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
				attendanceRecordId: at.id,
			}, {
				code: "ATTENDANCE_REJECTED",
				message: "This examination attendance was already rejected by its lecturer.",
				statusCode: 409,
			});
		}

		const verified = await writeSuccessfulVerification(tx, {
			booklet,
			session,
			student: targetStudent,
			userId,
			scannerRole: role,
			method,
			now,
			manual: Boolean(manualStudentNumber),
		});
		return { data: verified };
	});
	return throwFailure(result);
}

export async function scanStudentExamBooklet(db, userId, { token, sessionId }, now = new Date()) {
	return scanWithToken(db, { userId, role: "student", method: "STUDENT_SCAN", sessionId, token, now });
}

export async function previewInvigilatorExamBooklet(db, userId, sessionId, token, now = new Date()) {
	const result = await db.$transaction(async (tx) => {
		const { session } = await assertLecturerOwnsSession(tx, userId, sessionId);
		const args = {
			scannerUserId: userId,
			scannerRole: "lecturer",
			scanMethod: "INVIGILATOR_SCAN",
			sessionId: session.id,
			assessmentId: session.assessmentId,
			occurredAt: now,
		};
		let booklet = await tx.examBooklet.findFirst({
			where: { OR: [{ tokenHash: hashToken(token) }, { retiredTokenHash: hashToken(token) }] },
			select: bookletSelect(),
		});
		if (!booklet) {
			return recordRejectedScan(tx, args, {
				code: "INVALID_QR",
				message: "The QR code is invalid or has expired.",
				statusCode: 404,
			});
		}
		if (booklet.sessionId !== session.id || booklet.assessmentId !== session.assessmentId) {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
			}, {
				code: "WRONG_EXAM",
				message: "This booklet is allocated to a different examination session or assessment.",
			});
		}
		if (booklet.status !== "ALLOCATED" || booklet.retiredTokenHash === hashToken(token)) {
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
			}, {
				code: booklet.status === "REPLACED" ? "REPLACED_BOOKLET" : "INACTIVE_BOOKLET",
				message: booklet.status === "REPLACED"
					? "This booklet QR was invalidated when the booklet was replaced."
					: "This examination booklet has already been verified or is no longer active.",
			});
		}
		try {
			assertSessionOpen(session, now);
			await assertStudentEnrollment(tx, booklet.studentProfileId, session);
		} catch (error) {
			if (!(error instanceof AppError)) throw error;
			const exceptionCode = error.message.includes("enrolled") ? "NOT_ENROLLED"
				: error.message.includes("session") ? "INACTIVE_SESSION" : "INVALID_SESSION";
			return recordRejectedScan(tx, {
				...args,
				bookletId: booklet.id,
				studentProfileId: booklet.studentProfileId,
				assessmentId: booklet.assessmentId,
			}, { code: exceptionCode, message: error.message, statusCode: error.statusCode });
		}
		return {
			data: {
				bookletIdentifier: booklet.bookletIdentifier,
				student: booklet.student,
				assessment: booklet.assessment,
				status: booklet.status,
				identityConfirmationRequired: true,
			},
		};
	});
	return throwFailure(result);
}

export async function scanInvigilatorExamBooklet(db, userId, sessionId, { token, identityConfirmed }, now = new Date()) {
	return scanWithToken(db, {
		userId,
		role: "lecturer",
		method: "INVIGILATOR_SCAN",
		sessionId,
		token,
		identityConfirmed,
		now,
	});
}

export async function manualLookupExamBooklet(db, userId, sessionId, { studentNumber, identityConfirmed }, now = new Date()) {
	if (!identityConfirmed) throw new AppError(400, "Confirm the student's physical identity before manual verification");
	return scanWithToken(db, {
		userId,
		role: "lecturer",
		method: "INVIGILATOR_SCAN",
		sessionId,
		token: null,
		identityConfirmed,
		manualStudentNumber: studentNumber,
		now,
	});
}

export async function listExamBookletScans(db, userId, sessionId, { page = 1, limit = 20 } = {}) {
	await assertLecturerOwnsSession(db, userId, sessionId);
	const where = { sessionId };
	const [items, total] = await db.$transaction([
		db.examBookletScan.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
			select: {
				id: true,
				outcome: true,
				scanMethod: true,
				scannerRole: true,
				exceptionCode: true,
				exceptionDetails: true,
				occurredAt: true,
				booklet: { select: { id: true, bookletIdentifier: true, status: true } },
				student: { select: { id: true, studentNumber: true, user: { select: { displayName: true } } } },
				scanner: { select: { id: true, displayName: true } },
			},
		}),
		db.examBookletScan.count({ where }),
	]);
	return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function replaceExamBooklet(db, userId, role, bookletId, reason, now = new Date()) {
	const result = await db.$transaction(async (tx) => {
		const original = await tx.examBooklet.findUnique({
			where: { id: bookletId },
			select: {
				id: true,
				bookletIdentifier: true,
				studentProfileId: true,
				assessmentId: true,
				sessionId: true,
				tokenHash: true,
				status: true,
				session: {
					select: {
						id: true,
						courseUnitId: true,
						lecturerProfileId: true,
						assessmentId: true,
						sessionType: true,
						status: true,
						startsAt: true,
						endsAt: true,
						courseUnit: { select: { id: true, departmentId: true, department: { select: { designatedCodUserId: true } } } },
						assessment: { select: { id: true, type: true, courseUnitId: true } },
					},
				},
			},
		});
		if (!original) throw new AppError(404, "Examination booklet not found");
		const session = assertExamSession(original.session);
		await assertReplacementAuthority(tx, userId, role, session);
		if (!["ALLOCATED", "VERIFIED"].includes(original.status) || !original.tokenHash) {
			throw new AppError(409, "Only an active examination booklet can be replaced");
		}
		await assertStudentEnrollment(tx, original.studentProfileId, session);

		const replacementToken = generateToken();
		const replacementId = randomUUID();
		const replacementData = {
			id: replacementId,
			bookletIdentifier: randomUUID(),
			studentProfileId: original.studentProfileId,
			assessmentId: original.assessmentId,
			sessionId: original.sessionId,
			tokenHash: hashToken(replacementToken),
			status: "INVALIDATED",
		};
		const replacement = await tx.examBooklet.create({
			data: replacementData,
			select: { id: true, bookletIdentifier: true },
		});
		const updated = await tx.examBooklet.updateMany({
			where: { id: original.id, status: original.status, tokenHash: original.tokenHash },
			data: {
				status: "REPLACED",
				tokenHash: null,
				retiredTokenHash: original.tokenHash,
				replacedByBookletId: replacement.id,
				replacementApprovedByUserId: userId,
				replacementReason: reason.trim(),
				replacedAt: now,
			},
		});
		if (updated.count !== 1) throw new AppError(409, "This booklet was replaced concurrently; reload before approving another replacement");
		const activated = await tx.examBooklet.updateMany({
			where: { id: replacement.id, status: "INVALIDATED" },
			data: { status: "ALLOCATED" },
		});
		if (activated.count !== 1) throw new AppError(409, "The replacement booklet could not be activated");
		await recordAuditEvent({
			prismaClient: tx,
			actorId: userId,
			action: "EXAM_BOOKLET_REPLACED",
			entityType: "ExamBooklet",
			entityId: original.id,
			metadata: { replacementBookletId: replacement.id, sessionId: original.sessionId, assessmentId: original.assessmentId, reason: reason.trim() },
		});
		return {
			originalBookletId: original.id,
			replacementBookletId: replacement.id,
			bookletIdentifier: replacement.bookletIdentifier,
			qrToken: replacementToken,
			status: "ALLOCATED",
			replacedAt: now,
		};
	});
	return result;
}
