import { createHash } from "node:crypto";
import { generateReference } from "../../shared/utils/generate-reference.js";
import { addWorkingDays } from "../../shared/utils/business-days.js";
import { enqueueNotificationOnce } from "../../shared/services/notification-outbox.service.js";
import { lockDepartmentForReview } from "../../shared/services/department-review-lock.service.js";
import { getSystemSettingValue } from "../../shared/services/system-settings.service.js";
import { AppError } from "../../shared/utils/app-error.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { loadAttendanceDiscrepancySource } from "../../shared/services/attendance-discrepancy-source.service.js";
import { academicYearForDate, academicYearForPeriod } from "../../shared/utils/academic-year.js";
import { parseStudentRegistrationNumber } from "../../shared/utils/registration-number.js";

const FIRST_REPORT_ACADEMIC_YEAR = 2026;

export async function getStudentProfile(prisma, userId) {
	const profile = await prisma.studentProfile.findUnique({
		where: { userId },
		select: {
			id: true,
			studentNumber: true,
			officialEmail: true,
			notificationEmail: true,
			user: {
				select: {
					id: true,
					displayName: true,
					email: true,
				},
			},
		},
	});

	if (!profile) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	return profile;
}

export function buildAcademicYearOptions(enrolledPeriods, now = new Date()) {
	const currentAcademicYearStart = Number(academicYearForDate(now).slice(0, 4));
	const periodsByYear = new Map();
	const periodsInOrder = [...enrolledPeriods].sort((left, right) => {
		const leftStart = left.startsAt ? new Date(left.startsAt).valueOf() : Number.MAX_SAFE_INTEGER;
		const rightStart = right.startsAt ? new Date(right.startsAt).valueOf() : Number.MAX_SAFE_INTEGER;
		return leftStart - rightStart || left.id.localeCompare(right.id);
	});
	for (const period of periodsInOrder) {
		const year = academicYearForPeriod(period);
		if (!year) continue;
		const existing = periodsByYear.get(year);
		if (!existing || (period.startsAt && (!existing.startsAt || period.startsAt < existing.startsAt))) {
			periodsByYear.set(year, period);
		}
	}

	return Array.from({ length: Math.max(0, currentAcademicYearStart - FIRST_REPORT_ACADEMIC_YEAR + 1) }, (_, index) => {
		const startYear = FIRST_REPORT_ACADEMIC_YEAR + index;
		const value = `${startYear}/${String(startYear + 1).slice(-2)}`;
		return { value, label: value, academicPeriodId: periodsByYear.get(value)?.id || null };
	});
}

async function loadStudentReportOptions(prisma, student, now) {
	const registration = parseStudentRegistrationNumber(student.studentNumber);
	if (!registration) throw new AppError(422, "Ask an administrator to update your student number to the new department/course format before continuing");
	const enrollments = await prisma.unitEnrollment.findMany({
		where: {
			studentProfileId: student.id,
			courseUnit: {
				department: { initials: registration.departmentInitials },
				course: { is: { code: registration.courseCode } },
			},
		},
		select: {
			courseUnit: {
				select: {
					id: true,
					code: true,
					name: true,
				},
			},
			academicPeriod: { select: { id: true, code: true, name: true, startsAt: true } },
		},
	});

	const courses = new Map();
	for (const { courseUnit, academicPeriod } of enrollments) {
		if (!courses.has(courseUnit.id)) {
			courses.set(courseUnit.id, { ...courseUnit, enrolledPeriods: [] });
		}
		const course = courses.get(courseUnit.id);
		course.enrolledPeriods.push(academicPeriod);
	}

	return [...courses.values()]
		.map((course) => ({
			id: course.id,
			code: course.code,
			name: course.name,
			academicYears: buildAcademicYearOptions(course.enrolledPeriods, now),
		}))
		.sort((left, right) => left.code.localeCompare(right.code));
}

export async function getStudentReportOptions(prisma, userId, now = new Date()) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true, studentNumber: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	return loadStudentReportOptions(prisma, student, now);
}

export async function getStudentReports(prisma, userId, pagination = {}) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const page = pagination.page ?? 1;
	const limit = pagination.limit ?? 10;
	const skip = (page - 1) * limit;
	const where = { studentProfileId: student.id };

	const [reports, total] = await prisma.$transaction([
		prisma.missingMarkReport.findMany({
			where,
			skip,
			take: limit,
			select: {
				id: true,
				reference: true,
				assessmentComponent: true,
				description: true,
				status: true,
				submittedAt: true,
				createdAt: true,
				updatedAt: true,
				courseUnit: { select: { id: true, code: true, name: true } },
				academicPeriod: { select: { id: true, code: true, name: true } },
				assessment: { select: { id: true, code: true, name: true, type: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.missingMarkReport.count({ where }),
	]);

	return {
		reports,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function getStudentReportById(prisma, userId, reportId) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const report = await prisma.missingMarkReport.findFirst({
		where: {
			id: reportId,
			studentProfileId: student.id,
		},
		select: {
			id: true,
			reference: true,
			assessmentComponent: true,
			description: true,
			status: true,
			submittedAt: true,
			createdAt: true,
			updatedAt: true,
			statusHistory: {
				select: {
					previousStatus: true,
					newStatus: true,
					createdAt: true,
				},
				orderBy: { createdAt: "asc" },
			},
			courseUnit: { select: { id: true, code: true, name: true } },
			academicPeriod: { select: { id: true, code: true, name: true, startsAt: true, endsAt: true } },
			assessment: { select: { id: true, code: true, name: true, type: true } },
		},
	});

	if (!report) {
		const error = new Error("Missing-mark report not found.");
		error.statusCode = 404;
		throw error;
	}

	return report;
}

export async function getStudentReportComments(prisma, userId, reportId) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const report = await prisma.missingMarkReport.findFirst({
		where: {
			id: reportId,
			studentProfileId: student.id,
		},
		select: { id: true, studentProfileId: true },
	});

	if (!report || report.studentProfileId !== student.id) {
		const error = new Error("Missing-mark report not found.");
		error.statusCode = 404;
		throw error;
	}

	const comments = await prisma.reportComment.findMany({
		where: {
			reportId: report.id,
			OR: [
				{ isStudentVisible: true },
				{ authorUserId: userId },
			],
		},
		select: {
			id: true,
			body: true,
			createdAt: true,
			author: {
				select: {
					id: true,
					displayName: true,
					roles: {
						select: {
							role: { select: { name: true } },
						},
					},
				},
			},
		},
		orderBy: { createdAt: "asc" },
	});

	return comments.map((comment) => ({
		...comment,
		author: {
			...comment.author,
			roles: comment.author.roles.map((userRole) => userRole.role.name),
		},
	}));
}

export async function addStudentClarification(prisma, userId, reportId, body) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const report = await prisma.missingMarkReport.findFirst({
		where: { id: reportId, studentProfileId: student.id },
		select: { id: true, studentProfileId: true },
	});

	if (!report || report.studentProfileId !== student.id) {
		const error = new Error("Missing-mark report not found.");
		error.statusCode = 404;
		throw error;
	}

	return prisma.reportComment.create({
		data: {
			reportId: report.id,
			authorUserId: userId,
			body: body.trim(),
			isStudentVisible: true,
		},
		select: {
			id: true,
			body: true,
			createdAt: true,
			author: { select: { id: true, displayName: true } },
		},
	});
}

export async function createStudentAttendanceDiscrepancy(db, userId, input) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Student profile not found");
	try {
	return await db.$transaction(async (tx) => {
		const context = await loadAttendanceDiscrepancySource(tx, { ...input, studentProfileId: student.id });
		const discrepancy = await tx.attendanceDiscrepancy.create({
			data: {
				studentProfileId: student.id,
				attendanceRecordId: input.attendanceRecordId ?? null,
				assessmentAttendanceId: input.assessmentAttendanceId ?? null,
				attendanceAttemptId: input.attendanceAttemptId ?? null,
				assignedLecturerProfileId: context.assignedLecturerProfileId,
				description: input.description.trim(),
				status: "PENDING_LECTURER_REVIEW",
				submittedByUserId: userId,
				submitterType: "STUDENT",
			},
			select: { id: true, status: true, description: true, createdAt: true, assignedLecturerProfileId: true },
		});
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "STUDENT_ATTENDANCE_DISCREPANCY_SUBMITTED", entityType: "AttendanceDiscrepancy", entityId: discrepancy.id, metadata: { sourceType: context.sourceType } });
		return discrepancy;
	});
	} catch (error) {
		const target = (Array.isArray(error?.meta?.target) ? error.meta.target.join(" ") : String(error?.meta?.target ?? "")).toLowerCase();
		const hasStudent = target.includes("student_profile_id") || target.includes("studentprofileid");
		const hasSource = ["attendance_record_id", "assessment_attendance_id", "attendance_attempt_id", "attendancerecordid", "assessmentattendanceid", "attendanceattemptid"].some((field) => target.includes(field));
		if (error?.code === "P2002" && (target.includes("attendance_discrepancies_active_") || (hasStudent && hasSource))) {
			throw new AppError(409, "An active attendance discrepancy already exists for this student and source");
		}
		throw error;
	}
}

export async function listStudentAttendanceDiscrepancies(db, userId, { page = 1, limit = 10 } = {}) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Student profile not found");
	const where = { studentProfileId: student.id, submittedByUserId: userId, submitterType: "STUDENT" };
	const [items, total] = await db.$transaction([
		db.attendanceDiscrepancy.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit, select: { id: true, attendanceRecordId: true, assessmentAttendanceId: true, attendanceAttemptId: true, description: true, status: true, resolution: true, createdAt: true, updatedAt: true } }),
		db.attendanceDiscrepancy.count({ where }),
	]);
	return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getStudentAttendanceDiscrepancy(db, userId, discrepancyId) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Attendance discrepancy not found");
	const item = await db.attendanceDiscrepancy.findFirst({
		where: { id: discrepancyId, studentProfileId: student.id, submittedByUserId: userId, submitterType: "STUDENT" },
		select: {
			id: true, attendanceRecordId: true, assessmentAttendanceId: true, attendanceAttemptId: true,
			description: true, status: true, resolution: true, createdAt: true, updatedAt: true,
			decisions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, decision: true, explanation: true, previousStatus: true, newStatus: true, createdAt: true } },
			comments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, clarificationDecisionId: true, body: true, createdAt: true } },
		},
	});
	if (!item) throw new AppError(404, "Attendance discrepancy not found");
	return item;
}

export async function respondToStudentAttendanceDiscrepancy(db, userId, discrepancyId, body) {
	try {
	return await db.$transaction(async (tx) => {
		const student = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true } });
		if (!student) throw new AppError(404, "Attendance discrepancy not found");
		const item = await tx.attendanceDiscrepancy.findFirst({
			where: { id: discrepancyId, studentProfileId: student.id, submittedByUserId: userId, submitterType: "STUDENT" },
			select: { id: true, status: true },
		});
		if (!item) throw new AppError(404, "Attendance discrepancy not found");
		if (item.status !== "CLARIFICATION_REQUESTED") throw new AppError(409, "This discrepancy is not awaiting clarification");
		const request = await tx.attendanceDiscrepancyDecision.findFirst({
			where: { discrepancyId: item.id, decision: "REQUEST_CLARIFICATION" },
			orderBy: { createdAt: "desc" },
			select: { id: true },
		});
		if (!request) throw new AppError(409, "No clarification request is available to answer");
		const previousResponse = await tx.attendanceDiscrepancyComment.findFirst({ where: { discrepancyId: item.id, clarificationDecisionId: request.id, authorUserId: userId }, select: { id: true } });
		if (previousResponse) throw new AppError(409, "The latest clarification request has already been answered");
		const comment = await tx.attendanceDiscrepancyComment.create({
			data: { discrepancyId: item.id, authorUserId: userId, clarificationDecisionId: request.id, body: body.trim() },
			select: { id: true, discrepancyId: true, clarificationDecisionId: true, body: true, createdAt: true },
		});
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "STUDENT_ATTENDANCE_DISCREPANCY_CLARIFICATION", entityType: "AttendanceDiscrepancy", entityId: item.id, metadata: { clarificationDecisionId: request.id, commentId: comment.id } });
		return comment;
	});
	} catch (error) {
		const target = (Array.isArray(error?.meta?.target) ? error.meta.target.join(" ") : String(error?.meta?.target ?? "")).toLowerCase();
		if (error?.code === "P2002" && (target.includes("attendance_discrepancy_comments_clarification_author_key") ||
			((target.includes("clarification_decision_id") || target.includes("clarificationdecisionid")) && (target.includes("author_user_id") || target.includes("authoruserid"))))) {
			throw new AppError(409, "The clarification request has already been answered");
		}
		throw error;
	}
}

export async function submitStudentAppeal(prisma, userId, reportId, input = {}) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const reason = typeof input.reason === "string" ? input.reason.trim() : "";
	if (!reason) {
		const error = new Error("Appeal reason is required.");
		error.statusCode = 422;
		throw error;
	}

	const comments = typeof input.comments === "string" ? input.comments.trim() : "";

	return prisma.$transaction(async (transaction) => {
		const initialReport = await transaction.missingMarkReport.findFirst({
			where: { id: reportId, studentProfileId: student.id },
			select: { courseUnit: { select: { department: { select: { id: true } } } } },
		});
		if (!initialReport) {
			const error = new Error("Missing-mark report not found.");
			error.statusCode = 404;
			throw error;
		}
		await lockDepartmentForReview(transaction, initialReport.courseUnit.department.id);
		const lockedReports = await transaction.$queryRaw`
			SELECT id
			FROM missing_mark_reports
			WHERE id = ${reportId}::uuid AND student_profile_id = ${student.id}::uuid
			FOR UPDATE
		`;

		if (lockedReports.length === 0) {
			const error = new Error("Missing-mark report not found.");
			error.statusCode = 404;
			throw error;
		}

		const report = await transaction.missingMarkReport.findFirst({
			where: { id: reportId, studentProfileId: student.id },
			select: { id: true, status: true, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } },
		});

		if (!report) {
			const error = new Error("Missing-mark report not found.");
			error.statusCode = 404;
			throw error;
		}
		if (report.status?.toUpperCase() !== "REJECTED") {
			const error = new Error("Appeals are only allowed after a report is rejected.");
			error.statusCode = 409;
			throw error;
		}
		const designatedCod = report.courseUnit.department.designatedCodUserId;
		const validCod = designatedCod && await transaction.user.findFirst({
			where: { id: designatedCod, isActive: true, roles: { some: { role: { name: "cod" } } }, departmentMemberships: { some: { departmentId: report.courseUnit.department.id } } },
			select: { id: true },
		});
		if (!validCod) {
			const error = new Error("This department currently has no valid designated COD, so the submission cannot proceed.");
			error.statusCode = 409;
			throw error;
		}

		const rejection = await transaction.reportStatusHistory.findFirst({
			where: { reportId: report.id, newStatus: "REJECTED" },
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});
		if (!rejection) {
			const error = new Error("The report rejection timestamp is unavailable.");
			error.statusCode = 409;
			throw error;
		}
		const submittedAt = new Date();
		const configuredAppealWindow = await getSystemSettingValue(transaction, "appeal_window_calendar_days", 14);
		const appealWindow = Number.isInteger(configuredAppealWindow) && configuredAppealWindow >= 1 && configuredAppealWindow <= 365 ? configuredAppealWindow : 14;
		const appealDeadline = new Date(rejection.createdAt.valueOf() + appealWindow * 24 * 60 * 60 * 1000);
		if (submittedAt > appealDeadline) {
			const error = new Error(`The ${appealWindow}-calendar-day appeal deadline has passed.`);
			error.statusCode = 409;
			throw error;
		}

		const existingAppeal = await transaction.appeal.findFirst({
			where: { reportId: report.id },
			select: { id: true },
		});

		if (existingAppeal) {
			const error = new Error("A report can have at most one appeal submitted.");
			error.statusCode = 409;
			throw error;
		}

		const appeal = await transaction.appeal.create({
			data: {
				reportId: report.id,
				studentProfileId: student.id,
				reason,
				status: "Submitted",
				comments: comments || null,
				reviewDeadlineAt: addWorkingDays(submittedAt, 7, (await transaction.publicHoliday.findMany({ where: { date: { gte: new Date(submittedAt.toISOString().slice(0, 10)), lte: new Date(new Date(submittedAt.valueOf() + 400 * 86400000).toISOString().slice(0, 10)) } }, select: { date: true } })).map(({ date }) => date.toISOString().slice(0, 10))),
			},
			select: {
				id: true,
				reportId: true,
				studentProfileId: true,
				reason: true,
				status: true,
				comments: true,
				createdAt: true,
				updatedAt: true,
				reviewDeadlineAt: true,
			},
		});

		await transaction.auditLog.create({
			data: {
				actorId: userId,
				action: "REPORT_APPEAL_SUBMITTED",
				entityType: "Appeal",
				entityId: appeal.id,
				metadata: { reportId: report.id },
			},
		});
		const codUserId = designatedCod;
		if (codUserId) {
			const deadlineAt = appeal.reviewDeadlineAt;
			await enqueueNotificationOnce(transaction, {
				dedupeKey: `COD_APPEAL_OVERDUE:${appeal.id}:${codUserId}`,
				eventType: "COD_APPEAL_OVERDUE", entityType: "Appeal", entityId: appeal.id,
				recipientUserId: codUserId, reportId: report.id, title: "Appeal review overdue",
				message: `Appeal ${appeal.id} is awaiting a departmental decision.`, availableAt: new Date(deadlineAt.valueOf() + 1),
			});
		}

		return appeal;
	});
}

export async function submitMissingMarkReport(prisma, userId, input) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true, studentNumber: true },
	});
	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const courseUnits = await loadStudentReportOptions(prisma, student, new Date());
	const selectedCourseUnit = courseUnits.find(({ id }) => id === input.courseUnitId);
	const selectedAcademicYear = selectedCourseUnit?.academicYears.find(({ value }) => value === input.academicYear);
	if (!selectedAcademicYear?.academicPeriodId) {
		const error = new Error("You are not enrolled in the selected course unit and academic year.");
		error.statusCode = 422;
		throw error;
	}

	if (input.assessmentId) {
		const assessment = await prisma.assessment.findFirst({
			where: { id: input.assessmentId, courseUnitId: input.courseUnitId },
			select: { id: true },
		});
		if (!assessment) {
			const error = new Error("The selected assessment does not belong to the selected course unit.");
			error.statusCode = 422;
			throw error;
		}
	}

	const submittedAt = new Date();
	return prisma.$transaction(async (transaction) => {
		const assignment = await transaction.courseUnitLecturer.findUnique({
			where: {
				courseUnitId_academicYear: {
					courseUnitId: input.courseUnitId,
					academicYear: input.academicYear,
				},
			},
			select: {
				lecturerProfileId: true,
				lecturer: { select: { userId: true } },
			},
		});
		const initialStatus = assignment ? "PENDING" : "Submitted";
		const report = await transaction.missingMarkReport.create({
			data: {
				reference: generateReference(submittedAt),
				studentProfileId: student.id,
				courseUnitId: input.courseUnitId,
				academicPeriodId: selectedAcademicYear.academicPeriodId,
				assignedLecturerProfileId: assignment?.lecturerProfileId,
				assessmentId: input.assessmentId,
				assessmentComponent: input.assessmentComponent || "Not specified",
				description: input.description,
				status: initialStatus,
				submittedAt,
			},
			select: {
				id: true,
				reference: true,
				assessmentComponent: true,
				description: true,
				status: true,
				submittedAt: true,
				createdAt: true,
				courseUnit: { select: { id: true, code: true, name: true } },
				academicPeriod: { select: { id: true, code: true, name: true } },
				assessment: { select: { id: true, code: true, name: true, type: true } },
			},
		});

		await transaction.reportStatusHistory.create({
			data: {
				reportId: report.id,
				actorUserId: userId,
				newStatus: "Submitted",
				reason: "Report submitted by student.",
			},
		});

		if (assignment) {
			await transaction.reportAssignment.create({
				data: {
					reportId: report.id,
					actorUserId: userId,
					newLecturerProfileId: assignment.lecturerProfileId,
					reason: "Automatically assigned to the lecturer responsible for this course unit and academic year.",
				},
			});
			await transaction.reportStatusHistory.create({
				data: {
					reportId: report.id,
					actorUserId: userId,
					previousStatus: "Submitted",
					newStatus: "PENDING",
					reason: "Report assigned to the lecturer responsible for this course unit and academic year.",
				},
			});
			await transaction.notification.create({
				data: {
					userId: assignment.lecturer.userId,
					reportId: report.id,
					title: "New missing-mark report",
					message: `${student.studentNumber} submitted report ${report.reference} for ${report.courseUnit.code}.`,
					dedupeKey: `REPORT_ASSIGNED:${report.id}:${assignment.lecturer.userId}`,
				},
			});
		}
		await transaction.auditLog.create({
			data: {
				actorId: userId,
				action: "REPORT_SUBMITTED",
				entityType: "MissingMarkReport",
				entityId: report.id,
				metadata: { reference: report.reference, assignedLecturerProfileId: assignment?.lecturerProfileId ?? null },
			},
		});

		return report;
	});
}

function distanceBetweenMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
	const radians = (degrees) => degrees * Math.PI / 180;
	const earthRadiusMeters = 6_371_000;
	const latitudeDelta = radians(latitudeB - latitudeA);
	const longitudeDelta = radians(longitudeB - longitudeA);
	const haversine = Math.sin(latitudeDelta / 2) ** 2
		+ Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB))
		* Math.sin(longitudeDelta / 2) ** 2;
	return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export async function submitStudentAttendanceCheckIn(prisma, userId, input, now = new Date()) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true, studentNumber: true },
	});

	if (!student) throw new AppError(404, "Student profile not found");
	const registration = parseStudentRegistrationNumber(student.studentNumber);
	if (!registration) {
		throw new AppError(422, "Ask an administrator to update your student number to the new department/course format before continuing");
	}

	const accessTokenHash = createHash("sha256").update(input.token).digest("hex");
	const session = await prisma.attendanceSession.findUnique({
		where: { accessTokenHash },
		select: {
			id: true,
			status: true,
			startsAt: true,
			endsAt: true,
			sessionType: true,
			courseUnit: {
				select: {
					id: true,
					code: true,
					name: true,
					department: { select: { initials: true } },
					course: { select: { code: true } },
				},
			},
			classroom: {
				select: {
					name: true,
					latitude: true,
					longitude: true,
					boundaryMeters: true,
					isActive: true,
				},
			},
		},
	});

	if (!session || !session.classroom) {
		throw new AppError(404, "Attendance link is invalid or expired");
	}
	if (
		session.courseUnit.department?.initials !== registration.departmentInitials
		|| session.courseUnit.course?.code !== registration.courseCode
	) {
		throw new AppError(403, "This course unit is not part of your registered course");
	}

	if (
		session.status !== "active"
		|| new Date(session.startsAt) > now
		|| (session.endsAt && new Date(session.endsAt) <= now)
		|| !session.classroom.isActive
	) {
		throw new AppError(409, "This attendance session is not currently accepting check-ins");
	}

	const academicYear = academicYearForDate(session.startsAt);
	const enrollments = await prisma.unitEnrollment.findMany({
		where: {
			studentProfileId: student.id,
			courseUnitId: session.courseUnit.id,
		},
		select: { academicPeriod: { select: { startsAt: true, code: true, name: true } } },
	});

	if (!enrollments.some(({ academicPeriod }) => academicYearForPeriod(academicPeriod) === academicYear)) {
		throw new AppError(403, "You are not enrolled in this course unit for the session's academic year");
	}

	const distanceMeters = distanceBetweenMeters(
		input.latitude,
		input.longitude,
		Number(session.classroom.latitude),
		Number(session.classroom.longitude),
	);

	if (distanceMeters + input.accuracyMeters > session.classroom.boundaryMeters) {
		await prisma.attendanceAttempt.create({
			data: {
				sessionId: session.id,
				studentProfileId: student.id,
				outcome: "REJECTED",
				failureReason: distanceMeters > session.classroom.boundaryMeters
					? "OUTSIDE_CLASSROOM"
					: "LOCATION_ACCURACY_INSUFFICIENT",
			},
		});
		throw new AppError(403, distanceMeters > session.classroom.boundaryMeters
			? "Your device location is outside the configured classroom boundary"
			: "Your location is too close to the boundary to verify attendance. Move closer to the classroom and try again");
	}

	const existingRecord = await prisma.attendanceRecord.findUnique({
		where: { sessionId_studentProfileId: { sessionId: session.id, studentProfileId: student.id } },
		select: { id: true },
	});
	if (existingRecord) throw new AppError(409, "Attendance has already been recorded for this session");

	try {
		return await prisma.$transaction(async (transaction) => {
			const recordedAt = now;
			const record = await transaction.attendanceRecord.create({
				data: {
					sessionId: session.id,
					studentProfileId: student.id,
					status: "PRESENT",
					locationVerified: true,
					recordedAt,
				},
				select: { id: true, status: true, locationVerified: true, recordedAt: true },
			});

			await transaction.attendanceHistory.create({
				data: {
					attendanceRecordId: record.id,
					studentProfileId: student.id,
					courseUnitCode: session.courseUnit.code,
					courseUnitName: session.courseUnit.name,
					sessionStartedAt: session.startsAt,
					status: record.status,
					locationVerified: true,
					signedAt: recordedAt,
				},
			});

			return {
				record,
				session: {
					id: session.id,
					sessionType: session.sessionType,
					courseUnit: session.courseUnit,
					classroomName: session.classroom.name,
				},
			};
		});
	} catch (error) {
		if (error.code === "P2002") {
			throw new AppError(409, "Attendance has already been recorded for this session");
		}
		throw error;
	}
}

export async function getStudentAttendanceHistory(prisma, userId, pagination = {}) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const page = pagination.page ?? 1;
	const limit = pagination.limit ?? 10;
	const where = { studentProfileId: student.id };
	const skip = (page - 1) * limit;

	const [records, total] = await prisma.$transaction([
		prisma.attendanceHistory.findMany({
			where,
			skip,
			take: limit,
			select: {
				id: true,
				courseUnitCode: true,
				courseUnitName: true,
				sessionStartedAt: true,
				status: true,
				locationVerified: true,
				signedAt: true,
				createdAt: true,
				attendanceRecord: {
					select: {
						session: {
							select: {
								sessionType: true,
							},
						},
						corrections: {
							select: {
								originalStatus: true,
							correctedStatus: true,
							reason: true,
							createdAt: true,
							lecturer: { select: { staffNumber: true } },
							},
							orderBy: { createdAt: "desc" },
						},
					},
				},
			},
			orderBy: { signedAt: "desc" },
		}),
		prisma.attendanceHistory.count({ where }),
	]);

	return {
		records,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function getStudentNotifications(prisma, userId, pagination = {}) {
	const page = pagination.page ?? 1;
	const limit = pagination.limit ?? 10;
	const where = { userId };
	const skip = (page - 1) * limit;
	const unreadWhere = { userId, readAt: null };

	const [notifications, total, unreadCount] = await prisma.$transaction([
		prisma.notification.findMany({
			where,
			skip,
			take: limit,
			select: {
				id: true,
				title: true,
				message: true,
				readAt: true,
				createdAt: true,
				report: { select: { id: true, reference: true, status: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.notification.count({ where }),
		prisma.notification.count({ where: unreadWhere }),
	]);

	return {
		notifications,
		unreadCount,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function markStudentNotificationRead(prisma, userId, notificationId) {
	await prisma.notification.updateMany({
		where: { id: notificationId, userId, readAt: null },
		data: { readAt: new Date() },
	});

	const notification = await prisma.notification.findFirst({
		where: { id: notificationId, userId },
		select: {
			id: true,
			title: true,
			message: true,
			readAt: true,
			createdAt: true,
			report: { select: { id: true, reference: true, status: true } },
		},
	});

	if (!notification) {
		const error = new Error("Notification not found.");
		error.statusCode = 404;
		throw error;
	}

	return notification;
}

export async function updateStudentReport(prisma, userId, reportId, input) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const report = await prisma.missingMarkReport.findUnique({
		where: { id: reportId },
		select: {
			id: true,
			studentProfileId: true,
			status: true,
			courseUnitId: true,
			assessmentId: true,
			assessmentComponent: true,
			description: true,
		},
	});

	if (!report || report.studentProfileId !== student.id) {
		const error = new Error("Missing-mark report not found.");
		error.statusCode = 404;
		throw error;
	}

	if (report.status !== "Submitted") {
		const error = new Error("Report can only be edited while it is still in Submitted state.");
		error.statusCode = 409;
		throw error;
	}

	const payload = {};
	if (typeof input.assessmentId !== "undefined") {
		if (input.assessmentId) {
			const assessment = await prisma.assessment.findFirst({
				where: { id: input.assessmentId, courseUnitId: report.courseUnitId },
				select: { id: true },
			});
			if (!assessment) {
				const error = new Error("The selected assessment does not belong to the selected course unit.");
				error.statusCode = 422;
				throw error;
			}
		}
		payload.assessmentId = input.assessmentId;
	}
	if (typeof input.assessmentComponent !== "undefined") payload.assessmentComponent = input.assessmentComponent;
	if (typeof input.description !== "undefined") payload.description = input.description;
	if (Object.keys(payload).length === 0) {
		const error = new Error("At least one report field must be provided.");
		error.statusCode = 422;
		throw error;
	}

	return prisma.$transaction(async (transaction) => {
		const updateResult = await transaction.missingMarkReport.updateMany({
			where: { id: reportId, studentProfileId: student.id, status: "Submitted" },
			data: payload,
		});

		if (updateResult.count !== 1) {
			const error = new Error("Report can only be edited while it is still in Submitted state.");
			error.statusCode = 409;
			throw error;
		}

		const updated = await transaction.missingMarkReport.findUnique({
			where: { id: reportId },
			select: {
				id: true,
				reference: true,
				assessmentComponent: true,
				description: true,
				status: true,
				submittedAt: true,
				createdAt: true,
				updatedAt: true,
				courseUnit: { select: { id: true, code: true, name: true } },
				academicPeriod: { select: { id: true, code: true, name: true } },
				assessment: { select: { id: true, code: true, name: true, type: true } },
			},
		});

		await transaction.reportStatusHistory.create({
			data: {
				reportId: report.id,
				actorUserId: userId,
				previousStatus: report.status,
				newStatus: report.status,
				reason: "Student updated report details before a decision was recorded.",
			},
		});

		return updated;
	});
}

export async function withdrawStudentReport(prisma, userId, reportId) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const report = await prisma.missingMarkReport.findUnique({
		where: { id: reportId },
		select: {
			id: true,
			studentProfileId: true,
			status: true,
		},
	});

	if (!report || report.studentProfileId !== student.id) {
		const error = new Error("Missing-mark report not found.");
		error.statusCode = 404;
		throw error;
	}

	if (report.status !== "Submitted") {
		const error = new Error("Report can only be withdrawn while it is still in Submitted state.");
		error.statusCode = 409;
		throw error;
	}

	return prisma.$transaction(async (transaction) => {
		const updateResult = await transaction.missingMarkReport.updateMany({
			where: { id: reportId, studentProfileId: student.id, status: "Submitted" },
			data: { status: "Withdrawn" },
		});

		if (updateResult.count !== 1) {
			const error = new Error("Report can only be withdrawn while it is still in Submitted state.");
			error.statusCode = 409;
			throw error;
		}

		await transaction.reportStatusHistory.create({
			data: {
				reportId: report.id,
				actorUserId: userId,
				previousStatus: report.status,
				newStatus: "Withdrawn",
				reason: "Student withdrew the report before a decision was recorded.",
			},
		});

		return { id: report.id, status: "Withdrawn" };
	});
}
