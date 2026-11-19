import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { enqueueNotificationOnce } from "../../shared/services/notification-outbox.service.js";
import { getDesignatedCodDepartmentIds } from "../../shared/services/designated-cod-authorization.service.js";
import { academicYearForPeriod } from "../../shared/utils/academic-year.js";
import { AppError } from "../../shared/utils/app-error.js";

const MARK_SELECT = {
	id: true,
	value: true,
	version: true,
	createdAt: true,
	updatedAt: true,
	assessmentId: true,
	unitEnrollmentId: true,
	enteredByLecturerId: true,
};

function conflict(message) {
	return new AppError(409, message);
}

function isUniqueViolation(error) {
	return error?.code === "P2002" || error?.code === "23505";
}

function markValue(value) {
	return Number(value);
}

async function getActiveLecturer(db, userId) {
	const profile = await db.lecturerProfile.findFirst({
		where: {
			userId,
			user: {
				isActive: true,
				approvalStatus: "APPROVED",
				roles: { some: { role: { name: "lecturer" } } },
			},
		},
		select: { id: true },
	});
	if (!profile) throw new AppError(403, "An active, approved lecturer profile is required");
	return profile;
}

async function getAssessmentAndPeriod(db, assessmentId, academicPeriodId) {
	const [assessment, period] = await Promise.all([
		db.assessment.findUnique({
			where: { id: assessmentId },
			select: {
				id: true,
				courseUnitId: true,
				code: true,
				name: true,
				type: true,
				maximumMarks: true,
				courseUnit: { select: { id: true, code: true, name: true, departmentId: true } },
			},
		}),
		db.academicPeriod.findUnique({
			where: { id: academicPeriodId },
			select: { id: true, name: true, code: true, startsAt: true, endsAt: true, academicYear: true },
		}),
	]);
	if (!assessment) throw new AppError(404, "Assessment not found");
	if (!period) throw new AppError(404, "Academic period not found");
	const academicYear = academicYearForPeriod(period);
	if (!academicYear) throw new AppError(422, "Academic period has no recognizable academic year");
	if (assessment.maximumMarks === null || assessment.maximumMarks === undefined) {
		throw new AppError(422, "Assessment maximum mark is not configured");
	}
	return { assessment, period, academicYear };
}

async function requireAssignment(db, lecturerProfileId, courseUnitId, academicYear) {
	const assignment = await db.courseUnitLecturer.findFirst({
		where: { lecturerProfileId, courseUnitId, academicYear, isActive: true },
		select: { id: true },
	});
	if (!assignment) throw new AppError(404, "Active course-unit assignment not found");
}

async function getAssessmentAttendance(db, assessment, period, studentProfileIds) {
	const sessionType = String(assessment.type).toUpperCase();
	if (!studentProfileIds.length || !period.startsAt || !["CAT", "EXAM"].includes(sessionType)) return new Map();

	const startsAt = {
		gte: period.startsAt,
		...(period.endsAt ? { lte: period.endsAt } : {}),
	};
	const records = await db.attendanceRecord.findMany({
		where: {
			studentProfileId: { in: studentProfileIds },
			session: {
				is: {
					assessmentId: assessment.id,
					courseUnitId: assessment.courseUnitId,
					sessionType,
					startsAt,
				},
			},
		},
		orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
		select: {
			studentProfileId: true,
			status: true,
			examVerificationStatus: true,
			recordedAt: true,
		},
	});

	const attendanceByStudent = new Map();
	for (const record of records) {
		const eligible = ["PRESENT", "ATTENDED", "LATE"].includes(String(record.status).toUpperCase())
			&& (sessionType !== "EXAM" || record.examVerificationStatus === "VERIFIED");
		const current = attendanceByStudent.get(record.studentProfileId);
		if (!current || (eligible && !current.eligible)) {
			attendanceByStudent.set(record.studentProfileId, { ...record, eligible });
		}
	}
	return attendanceByStudent;
}

export async function getLecturerMarkOptions({ db = prisma, userId }) {
	const lecturer = await getActiveLecturer(db, userId);
	const [assignments, periods] = await Promise.all([
		db.courseUnitLecturer.findMany({
			where: { lecturerProfileId: lecturer.id, isActive: true, academicYear: { not: null } },
			select: {
				courseUnitId: true,
				academicYear: true,
				courseUnit: {
					select: {
						id: true,
						code: true,
						name: true,
						department: { select: { id: true, name: true, code: true } },
						assessments: {
							orderBy: [{ assessmentDate: "asc" }, { name: "asc" }],
							select: { id: true, code: true, name: true, type: true, maximumMarks: true, assessmentDate: true },
						},
					},
				},
			},
			orderBy: [{ academicYear: "desc" }, { createdAt: "desc" }],
		}),
		db.academicPeriod.findMany({
			where: { startsAt: { not: null } },
			select: { id: true, name: true, code: true, startsAt: true, endsAt: true, academicYear: true },
			orderBy: { startsAt: "desc" },
		}),
	]);
	const byUnit = new Map();
	for (const assignment of assignments) {
		const periodsForAssignment = periods.filter((period) => academicYearForPeriod(period) === assignment.academicYear);
		if (!periodsForAssignment.length) continue;
		const current = byUnit.get(assignment.courseUnitId) ?? {
			courseUnit: assignment.courseUnit,
			periods: new Map(),
		};
		for (const period of periodsForAssignment) current.periods.set(period.id, { ...period, academicYear: assignment.academicYear });
		byUnit.set(assignment.courseUnitId, current);
	}
	return [...byUnit.values()].map(({ courseUnit, periods: periodMap }) => ({
		courseUnit,
		academicPeriods: [...periodMap.values()].sort((a, b) => b.startsAt - a.startsAt),
	}));
}

export async function getAssessmentRoster({ db = prisma, userId, assessmentId, academicPeriodId }) {
	const lecturer = await getActiveLecturer(db, userId);
	const { assessment, period, academicYear } = await getAssessmentAndPeriod(db, assessmentId, academicPeriodId);
	await requireAssignment(db, lecturer.id, assessment.courseUnitId, academicYear);
	const enrollments = await db.unitEnrollment.findMany({
		where: { courseUnitId: assessment.courseUnitId, academicPeriodId: period.id },
		orderBy: { student: { user: { displayName: "asc" } } },
		select: {
			id: true,
			student: {
				select: {
					id: true,
					studentNumber: true,
					user: { select: { displayName: true } },
				},
			},
			marks: { where: { assessmentId }, select: MARK_SELECT },
		},
	});
	const attendanceByStudent = await getAssessmentAttendance(
		db,
		assessment,
		period,
		enrollments.map(({ student }) => student.id),
	);
	return {
		assessment: {
			id: assessment.id,
			code: assessment.code,
			name: assessment.name,
			type: assessment.type,
			maximumMarks: markValue(assessment.maximumMarks),
		},
		academicPeriod: period,
		academicYear,
		students: enrollments.map((enrollment) => ({
			enrollmentId: enrollment.id,
			student: enrollment.student,
			mark: enrollment.marks[0] ?? null,
			attendance: attendanceByStudent.get(enrollment.student.id) ?? null,
		})),
	};
}

export async function submitInitialMarks({ db = prisma, userId, assessmentId, academicPeriodId, marks }) {
	try {
		return await db.$transaction(async (tx) => {
			const lecturer = await getActiveLecturer(tx, userId);
			const { assessment, period, academicYear } = await getAssessmentAndPeriod(tx, assessmentId, academicPeriodId);
			await requireAssignment(tx, lecturer.id, assessment.courseUnitId, academicYear);
			const maximumMarks = markValue(assessment.maximumMarks);
			if (marks.some(({ value }) => !Number.isInteger(value) || value < 0)) {
				throw new AppError(400, "Marks must be nonnegative whole numbers");
			}
			if (marks.some(({ value }) => value > maximumMarks)) {
				throw new AppError(400, "A mark cannot exceed the assessment maximum");
			}
			const studentIds = marks.map(({ studentProfileId }) => studentProfileId);
			const enrollments = await tx.unitEnrollment.findMany({
				where: {
					studentProfileId: { in: studentIds },
					courseUnitId: assessment.courseUnitId,
					academicPeriodId: period.id,
				},
				select: { id: true, studentProfileId: true },
			});
			const enrollmentByStudent = new Map(enrollments.map((enrollment) => [enrollment.studentProfileId, enrollment]));
			if (enrollmentByStudent.size !== studentIds.length) {
				throw new AppError(422, "Every student must be enrolled in this course unit for the selected academic period");
			}
			const attendanceByStudent = await getAssessmentAttendance(tx, assessment, period, studentIds);
			if (studentIds.some((studentProfileId) => !attendanceByStudent.get(studentProfileId)?.eligible)) {
				throw new AppError(422, "Marks can only be recorded for students with eligible attendance for this assessment session");
			}
			const created = [];
			for (const item of marks) {
				const enrollment = enrollmentByStudent.get(item.studentProfileId);
				const mark = await tx.studentMark.create({
					data: {
						unitEnrollmentId: enrollment.id,
						assessmentId,
						enteredByLecturerId: lecturer.id,
						value: item.value,
					},
					select: MARK_SELECT,
				});
				await recordAuditEvent({
					prismaClient: tx,
					actorId: userId,
					action: "LECTURER_INITIAL_MARK_SUBMITTED",
					entityType: "StudentMark",
					entityId: mark.id,
					metadata: {
						assessmentId,
						unitEnrollmentId: enrollment.id,
						academicPeriodId: period.id,
						originalValue: null,
						finalValue: markValue(mark.value),
					},
				});
				created.push(mark);
			}
			return { created };
		});
	} catch (error) {
		if (isUniqueViolation(error)) throw conflict("An official mark already exists for one or more students");
		throw error;
	}
}

export async function getLecturerReportCorrections({ db = prisma, userId, reportId }) {
	const lecturer = await getActiveLecturer(db, userId);
	const report = await db.missingMarkReport.findFirst({
		where: { id: reportId, assignedLecturerProfileId: lecturer.id },
		select: { id: true },
	});
	if (!report) throw new AppError(404, "Assigned report not found");
	return db.markCorrection.findMany({
		where: { reportId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			status: true,
			originalValue: true,
			proposedValue: true,
			finalValue: true,
			reason: true,
			reviewComments: true,
			createdAt: true,
			decidedAt: true,
			reviewedBy: { select: { id: true, displayName: true } },
		},
	});
}

export async function submitMarkCorrection({ db = prisma, userId, reportId, proposedValue, reason }) {
	if (!Number.isInteger(proposedValue) || proposedValue < 0) {
		throw new AppError(400, "Proposed mark must be a nonnegative whole number");
	}
	const lecturer = await getActiveLecturer(db, userId);
	const report = await db.missingMarkReport.findFirst({
		where: { id: reportId, assignedLecturerProfileId: lecturer.id },
		select: {
			id: true,
			reference: true,
			status: true,
			studentProfileId: true,
			courseUnitId: true,
			academicPeriodId: true,
			academicPeriod: { select: { id: true, startsAt: true, endsAt: true, academicYear: true } },
			courseUnit: {
				select: {
					departmentId: true,
					department: { select: { designatedCodUserId: true } },
				},
			},
			assessmentId: true,
			assessment: {
				select: { id: true, courseUnitId: true, type: true, maximumMarks: true },
			},
		},
	});
	if (!report) throw new AppError(404, "Assigned report not found");
	if (String(report.status).toUpperCase() !== "APPROVED") {
		throw conflict("Mark corrections can only be proposed for approved reports");
	}
	if (!report.assessmentId || !report.assessment || report.assessment.courseUnitId !== report.courseUnitId) {
		throw new AppError(422, "The report must reference a valid assessment in its course unit");
	}
	const academicYear = academicYearForPeriod(report.academicPeriod);
	if (!academicYear) throw new AppError(422, "Report academic period has no recognizable academic year");
	await requireAssignment(db, lecturer.id, report.courseUnitId, academicYear);
	if (report.assessment.maximumMarks == null || proposedValue > markValue(report.assessment.maximumMarks)) {
		throw new AppError(400, "Proposed mark must not exceed the assessment maximum");
	}
	const enrollment = await db.unitEnrollment.findUnique({
		where: {
			studentProfileId_courseUnitId_academicPeriodId: {
				studentProfileId: report.studentProfileId,
				courseUnitId: report.courseUnitId,
				academicPeriodId: report.academicPeriodId,
			},
		},
		select: { id: true },
	});
	if (!enrollment) throw new AppError(422, "The reported student is not enrolled in this course unit for the report period");

	try {
		return await db.$transaction(async (tx) => {
			const currentLecturer = await getActiveLecturer(tx, userId);
			if (currentLecturer.id !== lecturer.id) throw conflict("Lecturer authorization changed; reload and submit again");
			const currentReport = await tx.missingMarkReport.findFirst({
				where: { id: reportId, assignedLecturerProfileId: lecturer.id, status: "APPROVED" },
				select: {
					id: true,
					reference: true,
					studentProfileId: true,
					courseUnitId: true,
					academicPeriodId: true,
					assessmentId: true,
					academicPeriod: { select: { id: true, startsAt: true, endsAt: true, academicYear: true } },
					courseUnit: { select: { departmentId: true, department: { select: { designatedCodUserId: true } } } },
					assessment: { select: { id: true, courseUnitId: true, type: true, maximumMarks: true } },
				},
			});
			if (
				!currentReport
				|| currentReport.assessmentId !== report.assessmentId
				|| currentReport.studentProfileId !== report.studentProfileId
				|| currentReport.academicPeriodId !== report.academicPeriodId
				|| currentReport.assessment?.courseUnitId !== currentReport.courseUnitId
			) throw conflict("The report changed; reload and submit a new correction proposal");
			const currentYear = academicYearForPeriod(currentReport.academicPeriod);
			if (!currentYear || currentReport.assessment?.maximumMarks == null || proposedValue > markValue(currentReport.assessment.maximumMarks)) {
				throw new AppError(400, "Proposed mark must not exceed the assessment maximum");
			}
			await requireAssignment(tx, lecturer.id, currentReport.courseUnitId, currentYear);
			const currentEnrollment = await tx.unitEnrollment.findUnique({
				where: {
					studentProfileId_courseUnitId_academicPeriodId: {
						studentProfileId: currentReport.studentProfileId,
						courseUnitId: currentReport.courseUnitId,
						academicPeriodId: currentReport.academicPeriodId,
					},
				},
				select: { id: true },
			});
			if (!currentEnrollment) throw new AppError(422, "The reported student is not enrolled for this assessment period");
			const attendanceByStudent = await getAssessmentAttendance(
				tx,
				currentReport.assessment,
				currentReport.academicPeriod,
				[currentReport.studentProfileId],
			);
			if (!attendanceByStudent.get(currentReport.studentProfileId)?.eligible) {
				throw new AppError(422, "A mark correction requires eligible attendance for this assessment session");
			}
			const pending = await tx.markCorrection.findFirst({
				where: { reportId, status: "PENDING_REVIEW" },
				select: { id: true },
			});
			if (pending) throw conflict("A correction proposal is already pending for this report");
			const mark = await tx.studentMark.findUnique({
				where: { unitEnrollmentId_assessmentId: { unitEnrollmentId: currentEnrollment.id, assessmentId: currentReport.assessmentId } },
				select: { id: true, value: true, version: true },
			});
			const correction = await tx.markCorrection.create({
				data: {
					reportId,
					markId: mark?.id ?? null,
					proposedByLecturerId: lecturer.id,
					originalValue: mark?.value ?? null,
					proposedValue,
					baseMarkVersion: mark?.version ?? null,
					baselineVerified: true,
					status: "PENDING_REVIEW",
					reason: reason.trim(),
				},
				select: {
					id: true,
					reportId: true,
					markId: true,
					originalValue: true,
					proposedValue: true,
					baseMarkVersion: true,
					status: true,
					reason: true,
					createdAt: true,
				},
			});
			await recordAuditEvent({
				prismaClient: tx,
				actorId: userId,
				action: "LECTURER_MARK_CORRECTION_SUBMITTED",
				entityType: "MarkCorrection",
				entityId: correction.id,
				metadata: {
					reportId,
					markId: correction.markId,
					originalValue: correction.originalValue == null ? null : markValue(correction.originalValue),
					proposedValue,
				},
			});
			const codUserId = currentReport.courseUnit.department.designatedCodUserId;
			const designatedDepartments = codUserId ? await getDesignatedCodDepartmentIds(tx, codUserId) : [];
			if (!codUserId || !designatedDepartments.includes(currentReport.courseUnit.departmentId)) {
				throw new AppError(409, "No active designated COD is available to review this correction");
			}
			await enqueueNotificationOnce(tx, {
				dedupeKey: `MARK_CORRECTION_SUBMITTED:${correction.id}:${codUserId}`,
				eventType: "MARK_CORRECTION_SUBMITTED",
				entityType: "MarkCorrection",
				entityId: correction.id,
				recipientUserId: codUserId,
				reportId,
				title: "Mark correction requires review",
				message: `A lecturer submitted a mark correction for report ${currentReport.reference}.`,
				availableAt: new Date(),
			});
			return correction;
		});
	} catch (error) {
		if (isUniqueViolation(error)) throw conflict("A correction proposal is already pending for this report");
		throw error;
	}
}

function correctionSelect() {
	return {
		id: true,
		reportId: true,
		markId: true,
		proposedByLecturerId: true,
		reviewedByUserId: true,
		originalValue: true,
		proposedValue: true,
		finalValue: true,
		baseMarkVersion: true,
		baselineVerified: true,
		status: true,
		reason: true,
		reviewComments: true,
		createdAt: true,
		decidedAt: true,
		report: {
			select: {
				id: true,
				reference: true,
				studentProfileId: true,
				courseUnitId: true,
				academicPeriodId: true,
				assessmentId: true,
				status: true,
				student: { select: { studentNumber: true, user: { select: { displayName: true, id: true } } } },
				courseUnit: { select: { id: true, code: true, name: true, departmentId: true } },
				academicPeriod: { select: { id: true, name: true, code: true, startsAt: true, endsAt: true, academicYear: true } },
				assessment: { select: { id: true, courseUnitId: true, code: true, name: true, type: true, maximumMarks: true } },
			},
		},
		proposedBy: { select: { id: true, user: { select: { displayName: true } } } },
		reviewedBy: { select: { id: true, displayName: true } },
	};
}

async function authorizedDepartments(db, userId) {
	const departmentIds = await getDesignatedCodDepartmentIds(db, userId);
	if (!departmentIds.length) throw new AppError(403, "Designated COD access is required");
	return departmentIds;
}

async function requireCorrectionDepartment(db, userId, correction) {
	const departmentIds = await authorizedDepartments(db, userId);
	if (!departmentIds.includes(correction.report.courseUnit.departmentId)) {
		throw new AppError(404, "Mark correction not found");
	}
}

export async function listCodMarkCorrections({ db = prisma, userId, departmentId, status = "PENDING_REVIEW", page = 1, limit = 20 }) {
	const departmentIds = await authorizedDepartments(db, userId);
	if (departmentId && !departmentIds.includes(departmentId)) throw new AppError(404, "Department not found");
	const where = {
		status,
		report: { courseUnit: { departmentId: { in: departmentId ? [departmentId] : departmentIds } } },
	};
	const [total, items] = await Promise.all([
		db.markCorrection.count({ where }),
		db.markCorrection.findMany({
			where,
			orderBy: { createdAt: "asc" },
			skip: (page - 1) * limit,
			take: limit,
			select: correctionSelect(),
		}),
	]);
	return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getCodMarkCorrection({ db = prisma, userId, correctionId }) {
	const correction = await db.markCorrection.findUnique({ where: { id: correctionId }, select: correctionSelect() });
	if (!correction) throw new AppError(404, "Mark correction not found");
	await requireCorrectionDepartment(db, userId, correction);
	return correction;
}

async function enqueueDecisionNotifications(tx, correction, decision, finalValue) {
	const recipients = new Set([
		correction.report.student.user.id,
		correction.proposedBy.user.id,
	]);
	for (const recipientUserId of recipients) {
		await enqueueNotificationOnce(tx, {
			dedupeKey: `MARK_CORRECTION_${decision}:${correction.id}:${recipientUserId}`,
			eventType: `MARK_CORRECTION_${decision}`,
			entityType: "MarkCorrection",
			entityId: correction.id,
			recipientUserId,
			reportId: correction.reportId,
			title: decision === "APPROVED" ? "Mark correction approved" : "Mark correction rejected",
			message: decision === "APPROVED"
				? `The mark correction for report ${correction.report.reference} was approved. Final mark: ${markValue(finalValue)}.`
				: `The mark correction for report ${correction.report.reference} was rejected.`,
			availableAt: new Date(),
		});
	}
}

export async function decideCodMarkCorrection({ db = prisma, userId, correctionId, decision, comments }) {
	const normalizedDecision = decision === "APPROVE" ? "APPROVED" : "REJECTED";
	if (normalizedDecision === "REJECTED" && !comments?.trim()) {
		throw new AppError(400, "Review comments are required to reject a correction");
	}
	return db.$transaction(async (tx) => {
		const correction = await tx.markCorrection.findUnique({
			where: { id: correctionId },
			select: correctionSelect(),
		});
		if (!correction) throw new AppError(404, "Mark correction not found");
		await requireCorrectionDepartment(tx, userId, correction);
		if (correction.status !== "PENDING_REVIEW") throw conflict("This correction has already been decided");

		let finalValue = null;
		let markId = correction.markId;
		if (normalizedDecision === "APPROVED") {
			if (!correction.baselineVerified) {
				throw conflict("This legacy proposal has no verified mark baseline; reject it with an explanation and submit a new verified proposal");
			}
			const proposedValue = markValue(correction.proposedValue);
			if (!Number.isInteger(proposedValue) || proposedValue < 0) {
				throw conflict("This proposal is not a nonnegative whole-number mark; reject it and submit a new whole-number proposal");
			}
			const assessment = correction.report.assessment;
			if (!assessment || assessment.id !== correction.report.assessmentId) {
				throw new AppError(422, "The report does not reference a valid assessment");
			}
			if (assessment.maximumMarks == null || markValue(correction.proposedValue) > markValue(assessment.maximumMarks)) {
				throw conflict("Assessment maximum changed; submit a new correction proposal");
			}
			const enrollment = await tx.unitEnrollment.findUnique({
				where: {
					studentProfileId_courseUnitId_academicPeriodId: {
						studentProfileId: correction.report.studentProfileId,
						courseUnitId: correction.report.courseUnitId,
						academicPeriodId: correction.report.academicPeriodId,
					},
				},
				select: { id: true },
			});
			if (!enrollment) throw new AppError(422, "The reported student is no longer enrolled for this assessment period");
			const attendanceByStudent = await getAssessmentAttendance(
				tx,
				assessment,
				correction.report.academicPeriod,
				[correction.report.studentProfileId],
			);
			if (!attendanceByStudent.get(correction.report.studentProfileId)?.eligible) {
				throw new AppError(422, "Mark correction approval requires eligible attendance for this assessment session");
			}

			if (correction.markId) {
				const current = await tx.studentMark.findUnique({
					where: { id: correction.markId },
					select: MARK_SELECT,
				});
				if (
					!current
					|| current.unitEnrollmentId !== enrollment.id
					|| current.assessmentId !== assessment.id
					|| current.version !== correction.baseMarkVersion
					|| markValue(current.value) !== markValue(correction.originalValue)
				) {
					throw conflict("The official mark changed after this proposal was submitted; submit a new correction proposal");
				}
				const updated = await tx.studentMark.updateMany({
					where: { id: current.id, version: correction.baseMarkVersion },
					data: { value: correction.proposedValue, version: { increment: 1 } },
				});
				if (updated.count !== 1) throw conflict("The official mark changed while this correction was being reviewed");
				markId = current.id;
			} else {
				const appeared = await tx.studentMark.findUnique({
					where: { unitEnrollmentId_assessmentId: { unitEnrollmentId: enrollment.id, assessmentId: assessment.id } },
					select: { id: true },
				});
				if (appeared) throw conflict("An official mark was created after this proposal; submit a new correction proposal");
				const created = await tx.studentMark.create({
					data: {
						unitEnrollmentId: enrollment.id,
						assessmentId: assessment.id,
						enteredByLecturerId: correction.proposedByLecturerId,
						value: correction.proposedValue,
					},
					select: { id: true },
				});
				markId = created.id;
			}
			finalValue = correction.proposedValue;
		}

		const updatedCorrection = await tx.markCorrection.updateMany({
			where: { id: correctionId, status: "PENDING_REVIEW" },
			data: {
				status: normalizedDecision,
				markId: normalizedDecision === "APPROVED" ? markId : correction.markId,
				finalValue,
				reviewedByUserId: userId,
				reviewComments: comments?.trim() || null,
				decidedAt: new Date(),
			},
		});
		if (updatedCorrection.count !== 1) throw conflict("This correction has already been decided");

		await recordAuditEvent({
			prismaClient: tx,
			actorId: userId,
			action: `COD_MARK_CORRECTION_${normalizedDecision}`,
			entityType: "MarkCorrection",
			entityId: correction.id,
			metadata: {
				reportId: correction.reportId,
				markId: normalizedDecision === "APPROVED" ? markId : correction.markId,
				originalValue: correction.originalValue == null ? null : markValue(correction.originalValue),
				proposedValue: markValue(correction.proposedValue),
				finalValue: finalValue == null ? null : markValue(finalValue),
				decision: normalizedDecision,
			},
		});
		await enqueueDecisionNotifications(tx, correction, normalizedDecision, finalValue);
		return {
			id: correction.id,
			status: normalizedDecision,
			markId: normalizedDecision === "APPROVED" ? markId : correction.markId,
			originalValue: correction.originalValue,
			proposedValue: correction.proposedValue,
			finalValue,
			reviewComments: comments?.trim() || null,
		};
	}).catch((error) => {
		if (isUniqueViolation(error)) throw conflict("The mark changed while this correction was being applied; reload and review again");
		throw error;
	});
}

export async function getStudentMarks({ db = prisma, userId, academicPeriodId }) {
	const student = await db.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});
	if (!student) throw new AppError(404, "Student profile not found");
	if (academicPeriodId && !await db.academicPeriod.findUnique({ where: { id: academicPeriodId }, select: { id: true } })) {
		throw new AppError(404, "Academic period not found");
	}
	return db.studentMark.findMany({
		where: {
			enrollment: {
				studentProfileId: student.id,
				...(academicPeriodId ? { academicPeriodId } : {}),
			},
		},
		orderBy: [
			{ enrollment: { academicPeriod: { startsAt: "desc" } } },
			{ assessment: { assessmentDate: "asc" } },
			{ assessment: { name: "asc" } },
		],
		select: {
			id: true,
			value: true,
			version: true,
			updatedAt: true,
			assessment: {
				select: {
					id: true,
					code: true,
					name: true,
					type: true,
					maximumMarks: true,
					courseUnit: { select: { id: true, code: true, name: true } },
				},
			},
			enrollment: {
				select: {
					academicPeriod: { select: { id: true, name: true, code: true, startsAt: true, endsAt: true, academicYear: true } },
				},
			},
		},
	});
}
