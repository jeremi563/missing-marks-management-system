import { prisma } from "../../config/database.js";
import { addWorkingDays } from "../utils/business-days.js";
import { AppError } from "../utils/app-error.js";
import { recordAuditEvent } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { enqueueNotificationOnce } from "./notification-outbox.service.js";
import { lockDepartmentForReview } from "./department-review-lock.service.js";
import { getDesignatedCodDepartmentIds, isActiveCodDepartmentMember } from "./designated-cod-authorization.service.js";
import { evidenceStorage, saveEvidenceFiles, withEvidenceFileCleanup } from "./evidence-storage.service.js";
import { academicYearBounds, academicYearForPeriod } from "../utils/academic-year.js";

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const SPECIAL_CASE_SCHEDULING_DAYS_MAX = 90;

function pageArgs(page = PAGE_DEFAULT, limit = LIMIT_DEFAULT) {
	const currentPage = Math.max(1, Number.parseInt(page, 10) || PAGE_DEFAULT);
	const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || LIMIT_DEFAULT));
	return { page: currentPage, limit: pageSize, skip: (currentPage - 1) * pageSize };
}

async function holidaysForYearRange(db, startAt, days = 400) {
	const end = new Date(new Date(startAt).valueOf() + days * 86400000);
	const rows = await db.publicHoliday.findMany({ where: { date: { gte: new Date(new Date(startAt).toISOString().slice(0, 10)), lte: new Date(end.toISOString().slice(0, 10)) } }, select: { date: true } });
	return rows.map(({ date }) => date.toISOString().slice(0, 10));
}

async function reportContext(db, reportId) {
	const report = await db.missingMarkReport.findUnique({
		where: { id: reportId },
		select: {
			id: true, status: true, studentProfileId: true, assignedLecturerProfileId: true,
			courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } },
			student: { select: { userId: true } },
		},
	});
	if (!report) throw new AppError(404, "Missing-mark report not found");
	return report;
}

async function validDesignatedCod(db, departmentId, userId) {
	return isActiveCodDepartmentMember(db, userId, departmentId);
}

async function lockCodUsersForRoleTransfer(tx, currentCodUserId, nextCodUserId) {
	const userIds = [...new Set([currentCodUserId, nextCodUserId].filter(Boolean))].sort();
	for (const userId of userIds) {
		await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
	}
}

async function requireValidDepartmentCod(db, department) {
	if (!await validDesignatedCod(db, department.id, department.designatedCodUserId)) {
		throw new AppError(409, "This department currently has no valid designated COD, so the submission cannot proceed");
	}
	return department.designatedCodUserId;
}

async function validDesignatedDepartmentIds(db, userId) {
	return getDesignatedCodDepartmentIds(db, userId);
}

async function requireValidDesignatedCodForReport(db, userId, department) {
	if (department.designatedCodUserId !== userId || !await validDesignatedCod(db, department.id, userId)) throw new AppError(404, "Review item not found");
}

async function enqueueCodOverdue(db, { entityType, entityId, reportId, recipientUserId, deadlineAt, title, message }) {
	if (!recipientUserId) return;
	const eventPrefix = entityType === "SpecialCase" ? "COD_SPECIAL_CASE" : entityType === "MissingMarkReport" ? "COD_REPORT" : `COD_${entityType.toUpperCase()}`;
	const idempotencyKey = entityType === "MissingMarkReport" ? `COD_REPORT_OVERDUE:${entityId}:${recipientUserId}` : `${eventPrefix}_OVERDUE:${entityId}:${recipientUserId}`;
	await enqueueNotificationOnce(db, {
		dedupeKey: idempotencyKey,
		eventType: `${eventPrefix}_OVERDUE`,
		entityType,
		entityId,
		recipientUserId,
		reportId,
		title,
		message,
			availableAt: new Date(deadlineAt.valueOf() + 1),
	});
}

export async function createSpecialCase({ db = prisma, userId, role, reportId, categoryId, description, files = [], storage = evidenceStorage }) {
	return withEvidenceFileCleanup((storageKeys) => db.$transaction(async (tx) => {
		const initialReport = await reportContext(tx, reportId);
		await lockDepartmentForReview(tx, initialReport.courseUnit.department.id);
		const report = await reportContext(tx, reportId);
		await requireValidDepartmentCod(tx, report.courseUnit.department);
		if (!["PENDING", "ESCALATED", "REJECTED"].includes(report.status.toUpperCase())) throw new AppError(409, "Special cases are allowed only for PENDING, ESCALATED or REJECTED reports");
		if (role === "student") {
			const profile = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true } });
			if (!profile || profile.id !== report.studentProfileId) throw new AppError(404, "Missing-mark report not found");
		} else if (role === "lecturer") {
			const lecturer = await tx.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
			if (!lecturer || lecturer.id !== report.assignedLecturerProfileId) throw new AppError(404, "Missing-mark report not found");
		} else throw new AppError(403, "Only students and lecturers may submit special cases");

		const category = await tx.specialCaseCategory.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true, code: true, name: true } });
		if (!category) throw new AppError(422, "An active special-case category is required");
		const submittedAt = new Date();
		const holidays = await holidaysForYearRange(tx, submittedAt, 40);
		const reviewDeadlineAt = addWorkingDays(submittedAt, 7, holidays);
		const specialCase = await tx.specialCase.create({
			data: {
				reportId,
				submittedByUserId: userId,
				categoryId: category.id,
				category: category.name,
				description: description.trim(),
				status: "Submitted",
				reviewDeadlineAt,
			},
			select: { id: true, reportId: true, submittedByUserId: true, categoryId: true, category: true, description: true, status: true, reviewDeadlineAt: true, createdAt: true },
		});
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_SUBMITTED", entityType: "SpecialCase", entityId: specialCase.id, metadata: { reportId, categoryId: category.id, submitterRole: role } });
		const evidence = await saveEvidenceFiles({
			db: tx,
			files,
			reportId,
			specialCaseId: specialCase.id,
			uploaderId: userId,
			storageKeys,
			storage,
		});
		await enqueueCodOverdue(tx, {
			entityType: "SpecialCase", entityId: specialCase.id, reportId,
			recipientUserId: report.courseUnit.department.designatedCodUserId,
			deadlineAt: reviewDeadlineAt, title: "Special case review overdue",
			message: `Special case ${specialCase.id} is awaiting a departmental decision.`,
		});
		return evidence.length ? { ...specialCase, evidence } : specialCase;
	}), { storage });
}

export async function startAssignedReportWork({ db = prisma, userId, reportId }) {
	return db.$transaction(async (tx) => {
		const lecturer = await tx.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
		if (!lecturer) throw new AppError(404, "Lecturer profile not found");
		const initialReport = await tx.missingMarkReport.findFirst({
			where: { id: reportId, assignedLecturerProfileId: lecturer.id, status: "PENDING" },
			select: { id: true, status: true, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } },
		});
		if (!initialReport) throw new AppError(404, "Assigned pending report not found");
		await lockDepartmentForReview(tx, initialReport.courseUnit.department.id);
		const report = await tx.missingMarkReport.findFirst({
			where: { id: reportId, assignedLecturerProfileId: lecturer.id, status: "PENDING" },
			select: { id: true, status: true, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } },
		});
		if (!report) throw new AppError(404, "Assigned pending report not found");
		const assignment = await tx.reportAssignment.findFirst({ where: { reportId, newLecturerProfileId: lecturer.id }, orderBy: { createdAt: "desc" }, select: { id: true, workStartedAt: true } });
		if (!assignment) throw new AppError(409, "A recorded assignment is required before work can start");
		if (assignment.workStartedAt) throw new AppError(409, "Work has already been started for this assignment");
		const startedAt = new Date();
		const holidays = await holidaysForYearRange(tx, startedAt, 400);
		const deadlineAt = addWorkingDays(startedAt, 7, holidays);
		const update = await tx.reportAssignment.updateMany({ where: { id: assignment.id, workStartedAt: null }, data: { workStartedAt: startedAt, deadlineAt } });
		if (update.count !== 1) throw new AppError(409, "Work was started concurrently");
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "LECTURER_REPORT_WORK_STARTED", entityType: "MissingMarkReport", entityId: reportId, metadata: { assignmentId: assignment.id, workStartedAt: startedAt, deadlineAt } });
		const profile = await tx.lecturerProfile.findUnique({ where: { id: lecturer.id }, select: { userId: true } });
		const key = `REPORT_OVERDUE:${assignment.id}`;
		const overdueAt = new Date(deadlineAt.valueOf() + 1);
		await enqueueNotificationOnce(tx, { dedupeKey: `LECTURER_${key}:${profile.userId}`, eventType: "LECTURER_REPORT_OVERDUE", entityType: "MissingMarkReport", entityId: reportId, recipientUserId: profile.userId, reportId, title: "Assigned report overdue", message: `Report ${reportId} has passed its lecturer decision deadline.`, availableAt: overdueAt });
		return { reportId, assignmentId: assignment.id, workStartedAt: startedAt, deadlineAt };
	});
}

function pastAssessmentDate(assessmentDate, period, now) {
	if (!(assessmentDate instanceof Date) || Number.isNaN(assessmentDate.valueOf())) return false;
	if (!(period.startsAt instanceof Date) || !(period.endsAt instanceof Date)) return false;
	return assessmentDate < now && assessmentDate >= period.startsAt && assessmentDate < period.endsAt;
}

function isDuplicateSpecialCaseError(error) {
	if (error?.code !== "P2002") return false;
	const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
	return (target.includes("studentProfileId") || target.includes("student_profile_id"))
		&& (target.includes("assessmentId") || target.includes("assessment_id"));
}

export async function createStandaloneStudentSpecialCase({
	db = prisma,
	userId,
	courseUnitId,
	academicPeriodId,
	assessmentId,
	categoryId,
	description,
	files = [],
	storage = evidenceStorage,
	now = new Date(),
}) {
	if (!Array.isArray(files) || files.length === 0) throw new AppError(422, "At least one supporting evidence file is required");

	try {
		return await withEvidenceFileCleanup((storageKeys) => db.$transaction(async (tx) => {
			const student = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true } });
			if (!student) throw new AppError(404, "Student profile not found");

			const enrollment = await tx.unitEnrollment.findUnique({
				where: { studentProfileId_courseUnitId_academicPeriodId: { studentProfileId: student.id, courseUnitId, academicPeriodId } },
				select: {
					id: true,
					academicPeriod: { select: { id: true, name: true, code: true, startsAt: true, endsAt: true, academicYear: true } },
					courseUnit: { select: { id: true, code: true, name: true, departmentId: true } },
				},
			});
			if (!enrollment) throw new AppError(422, "You must be registered for the selected course unit and academic period");
			const period = enrollment.academicPeriod;
			if (!(period.startsAt instanceof Date) || !(period.endsAt instanceof Date) || period.startsAt >= period.endsAt) {
				throw new AppError(422, "The selected academic period does not have valid date boundaries");
			}

			const assessment = await tx.assessment.findFirst({
				where: { id: assessmentId, courseUnitId },
				select: { id: true, code: true, name: true, type: true, assessmentDate: true },
			});
			if (!assessment || !pastAssessmentDate(assessment.assessmentDate, period, now)) {
				throw new AppError(422, "Select an assessment for the selected course unit and period that has already taken place");
			}

			const category = await tx.specialCaseCategory.findFirst({
				where: { id: categoryId, isActive: true },
				select: { id: true, code: true, name: true },
			});
			if (!category) throw new AppError(422, "An active special-case category is required");

			await lockDepartmentForReview(tx, enrollment.courseUnit.departmentId);
			const duplicate = await tx.specialCase.findUnique({
				where: { studentProfileId_assessmentId: { studentProfileId: student.id, assessmentId } },
				select: { id: true },
			});
			if (duplicate) throw new AppError(409, "A special-case application already exists for this assessment");

			const academicYear = academicYearForPeriod(period);
			const assignments = academicYear ? await tx.courseUnitLecturer.findMany({
				where: { courseUnitId, academicYear, isActive: true, lecturer: { user: { isActive: true, approvalStatus: "APPROVED" } } },
				select: { lecturer: { select: { userId: true } } },
			}) : [];
			const lecturerUserIds = [...new Set(assignments.map(({ lecturer }) => lecturer.userId))];
			const administrativeResolutionRequired = lecturerUserIds.length === 0;
			const specialCase = await tx.specialCase.create({
				data: {
					reportId: null,
					studentProfileId: student.id,
					courseUnitId,
					academicPeriodId,
					assessmentId,
					submittedByUserId: userId,
					categoryId: category.id,
					category: category.name,
					description: description.trim(),
					status: "PENDING_LECTURER_REVIEW",
					submittedAt: now,
					administrativeResolutionRequired,
				},
				select: {
					id: true, reportId: true, studentProfileId: true, courseUnitId: true, academicPeriodId: true,
					assessmentId: true, submittedByUserId: true, categoryId: true, category: true, description: true,
					status: true, submittedAt: true, administrativeResolutionRequired: true, createdAt: true,
				},
			});
			await recordAuditEvent({
				prismaClient: tx,
				actorId: userId,
				action: "SPECIAL_CASE_SUBMITTED_STANDALONE",
				entityType: "SpecialCase",
				entityId: specialCase.id,
				metadata: { courseUnitId, academicPeriodId, assessmentId, categoryId: category.id, administrativeResolutionRequired },
			});
			const evidence = await saveEvidenceFiles({
				db: tx,
				files,
				reportId: null,
				specialCaseId: specialCase.id,
				uploaderId: userId,
				storageKeys,
				storage,
			});

			await enqueueNotificationOnce(tx, {
				dedupeKey: `SPECIAL_CASE_SUBMITTED:${specialCase.id}:${userId}`,
				eventType: "SPECIAL_CASE_SUBMITTED",
				entityType: "SpecialCase",
				entityId: specialCase.id,
				recipientUserId: userId,
				title: "Special-case application submitted",
				message: "Your application has been submitted for review.",
			});
			if (!administrativeResolutionRequired) {
				for (const reviewerUserId of lecturerUserIds) {
					await enqueueNotificationOnce(tx, {
						dedupeKey: `SPECIAL_CASE_REVIEW_REQUIRED:${specialCase.id}:${reviewerUserId}`,
						eventType: "SPECIAL_CASE_REVIEW_REQUIRED",
						entityType: "SpecialCase",
						entityId: specialCase.id,
						recipientUserId: reviewerUserId,
						title: "Special case awaiting review",
						message: `Special case ${specialCase.id} requires your review.`,
					});
				}
			} else {
				const administrators = await tx.user.findMany({
					where: { isActive: true, approvalStatus: "APPROVED", roles: { some: { role: { name: "administrator" } } } },
					select: { id: true },
				});
				for (const administrator of administrators) {
					await enqueueNotificationOnce(tx, {
						dedupeKey: `SPECIAL_CASE_ASSIGNMENT_RESOLUTION:${specialCase.id}:${administrator.id}`,
						eventType: "SPECIAL_CASE_ASSIGNMENT_RESOLUTION_REQUIRED",
						entityType: "SpecialCase",
						entityId: specialCase.id,
						recipientUserId: administrator.id,
						title: "Special case requires assignment resolution",
						message: `Special case ${specialCase.id} has no unique active lecturer assignment.`,
					});
				}
			}
			return { ...specialCase, evidence };
		}), { storage });
	} catch (error) {
		if (isDuplicateSpecialCaseError(error)) throw new AppError(409, "A special-case application already exists for this assessment");
		throw error;
	}
}

export async function listStudentSpecialCaseOptions({ db = prisma, userId, now = new Date() }) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Student profile not found");
	const [enrollments, categories, existingCases] = await Promise.all([
		db.unitEnrollment.findMany({
			where: { studentProfileId: student.id },
			orderBy: [{ academicPeriod: { startsAt: "desc" } }, { courseUnit: { code: "asc" } }],
			select: {
				academicPeriod: { select: { id: true, code: true, name: true, startsAt: true, endsAt: true, academicYear: true } },
				courseUnit: { select: { id: true, code: true, name: true } },
			},
		}),
		db.specialCaseCategory.findMany({
			where: { isActive: true },
			select: { id: true, code: true, name: true, description: true },
			orderBy: { name: "asc" },
		}),
		db.specialCase.findMany({ where: { studentProfileId: student.id, assessmentId: { not: null } }, select: { assessmentId: true } }),
	]);
	const existingAssessmentIds = new Set(existingCases.map(({ assessmentId }) => assessmentId));
	const options = await Promise.all(enrollments.map(async ({ academicPeriod, courseUnit }) => {
		if (!(academicPeriod.startsAt instanceof Date) || !(academicPeriod.endsAt instanceof Date) || academicPeriod.startsAt >= academicPeriod.endsAt) {
			return { academicPeriod, courseUnit, assessments: [] };
		}
		const assessments = await db.assessment.findMany({
			where: {
				courseUnitId: courseUnit.id,
				assessmentDate: { gte: academicPeriod.startsAt, lt: academicPeriod.endsAt < now ? academicPeriod.endsAt : now },
			},
			orderBy: [{ assessmentDate: "desc" }, { name: "asc" }],
			select: { id: true, code: true, name: true, type: true, assessmentDate: true },
		});
		return { academicPeriod, courseUnit, assessments: assessments.filter(({ id }) => !existingAssessmentIds.has(id)) };
	}));
	return { categories, enrollments: options };
}

export async function listActiveSpecialCaseCategories(db = prisma) {
	return db.specialCaseCategory.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, description: true }, orderBy: { name: "asc" } });
}

export async function listActiveAssessmentTypes(db = prisma) {
	return db.assessmentType.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
}

export async function designateDepartmentCod({ db = prisma, actorUserId, departmentId, codUserId }) {
	return db.$transaction(async (tx) => {
		await lockDepartmentForReview(tx, departmentId);
		const department = await tx.department.findUnique({ where: { id: departmentId }, select: { id: true, designatedCodUserId: true } });
		if (!department) throw new AppError(404, "Department not found");
		await lockCodUsersForRoleTransfer(tx, department.designatedCodUserId, codUserId);
		const codUser = await tx.user.findFirst({
			where: {
				id: codUserId,
				isActive: true,
				approvalStatus: "APPROVED",
				roles: { some: { role: { name: "lecturer" } } },
			},
			select: { id: true, roles: { select: { role: { select: { name: true } } } } },
		});
		if (!codUser) throw new AppError(422, "Designated COD must be an active, approved lecturer");
		const hasCodRole = codUser.roles.some(({ role }) => role.name === "cod");
		if (!hasCodRole) {
			const codRole = await tx.role.upsert({
				where: { name: "cod" },
				update: {},
				create: { name: "cod", description: "System cod role" },
				select: { id: true },
			});
			await tx.userRole.create({ data: { userId: codUserId, roleId: codRole.id } });
		}
		const membership = await tx.departmentMembership.findUnique({
			where: { userId_departmentId: { userId: codUserId, departmentId } },
			select: { id: true },
		});
		if (!membership) await tx.departmentMembership.create({ data: { userId: codUserId, departmentId } });
		const result = await tx.department.update({ where: { id: departmentId }, data: { designatedCodUserId: codUserId }, select: { id: true, name: true, code: true, designatedCodUserId: true } });
		if (department.designatedCodUserId && department.designatedCodUserId !== codUserId) {
			const otherDesignations = await tx.department.count({
				where: { id: { not: departmentId }, designatedCodUserId: department.designatedCodUserId },
			});
			if (otherDesignations === 0) {
				await tx.userRole.deleteMany({
					where: { userId: department.designatedCodUserId, role: { name: "cod" } },
				});
			}
		}
		await recordAuditEvent({
			prismaClient: tx,
			actorId: actorUserId,
			action: "DEPARTMENT_COD_DESIGNATED",
			entityType: "Department",
			entityId: departmentId,
			metadata: { previousCodUserId: department.designatedCodUserId, designatedCodUserId: codUserId },
		});
		if (department.designatedCodUserId !== codUserId) await enqueueOutstandingCodReviews(tx, departmentId, codUserId);
		return result;
	});
}

async function enqueueOutstandingCodReviews(tx, departmentId, codUserId) {
	const appeals = await tx.appeal.findMany({
		where: { status: "Submitted", report: { courseUnit: { departmentId } } },
		select: { id: true, reportId: true, reviewDeadlineAt: true },
	});
	const cases = await tx.specialCase.findMany({
		where: { status: "Submitted", report: { courseUnit: { departmentId } } },
		select: { id: true, reportId: true, reviewDeadlineAt: true },
	});
	for (const appeal of appeals) {
		if (appeal.reviewDeadlineAt) await enqueueCodOverdue(tx, {
			entityType: "Appeal", entityId: appeal.id, reportId: appeal.reportId, recipientUserId: codUserId,
			deadlineAt: appeal.reviewDeadlineAt, title: "Appeal review overdue", message: `Appeal ${appeal.id} is awaiting a departmental decision.`,
		});
	}
	for (const item of cases) {
		if (item.reviewDeadlineAt) await enqueueCodOverdue(tx, {
			entityType: "SpecialCase", entityId: item.id, reportId: item.reportId, recipientUserId: codUserId,
			deadlineAt: item.reviewDeadlineAt, title: "Special case review overdue", message: `Special case ${item.id} is awaiting a departmental decision.`,
		});
	}
}

export async function listSpecialCaseCategories({ db = prisma, userId }) {
	if (!(await validDesignatedDepartmentIds(db, userId)).length) throw new AppError(403, "Only a designated departmental COD may manage categories");
	return db.specialCaseCategory.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function saveSpecialCaseCategory({ db = prisma, userId, id, code, name, description, isActive }) {
	return db.$transaction(async (tx) => {
		if (!(await validDesignatedDepartmentIds(tx, userId)).length) throw new AppError(403, "Only a designated departmental COD may manage categories");
		let result;
		if (id) {
			const current = await tx.specialCaseCategory.findUnique({ where: { id } });
			if (!current) throw new AppError(404, "Special-case category not found");
			result = await tx.specialCaseCategory.update({ where: { id }, data: { code, name, description: description ?? null, isActive: isActive ?? current.isActive, managedByUserId: userId } });
		} else {
			result = await tx.specialCaseCategory.create({ data: { code, name, description: description ?? null, managedByUserId: userId } });
		}
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: id ? "SPECIAL_CASE_CATEGORY_UPDATED" : "SPECIAL_CASE_CATEGORY_CREATED", entityType: "SpecialCaseCategory", entityId: result.id, metadata: { code: result.code, isActive: result.isActive } });
		return result;
	});
}

async function serializeCase(db, item, includeEvidence) {
	if (!includeEvidence) return { ...item, evidence: [] };
	const evidence = await db.specialCaseEvidence.findMany({
		where: { specialCaseId: item.id, reportId: item.reportId },
		select: { id: true, originalName: true, mediaType: true, sizeBytes: true, createdAt: true, uploadedBy: { select: { id: true, displayName: true } } },
		orderBy: { createdAt: "asc" },
	});
	return { ...item, evidence };
}

async function getAuthorizedCase({ db, userId, role, caseId }) {
	const item = await db.specialCase.findUnique({
		where: { id: caseId },
		select: {
			id: true, reportId: true, studentProfileId: true, courseUnitId: true, academicPeriodId: true, assessmentId: true,
			submittedByUserId: true, categoryId: true, category: true, description: true, status: true,
			decisionByUserId: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, submittedAt: true,
			schedulingDeadlineAt: true, administrativeResolutionRequired: true, createdAt: true,
			categoryRecord: { select: { id: true, code: true, name: true, isActive: true } },
			report: { select: {
				studentProfileId: true,
				assignedLecturerProfileId: true,
				courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } },
			} },
			student: { select: { id: true, studentNumber: true, user: { select: { id: true, displayName: true } } } },
			courseUnit: { select: { id: true, code: true, name: true, department: { select: { id: true, designatedCodUserId: true } } } },
			academicPeriod: { select: { id: true, code: true, name: true, startsAt: true, endsAt: true, academicYear: true } },
			assessment: { select: { id: true, code: true, name: true, type: true, assessmentDate: true } },
			reviews: { orderBy: { createdAt: "asc" }, select: { id: true, reviewerUserId: true, reviewerRole: true, action: true, decision: true, comments: true, previousStatus: true, newStatus: true, createdAt: true } },
			schedules: { orderBy: { version: "asc" }, select: { id: true, version: true, startsAt: true, endsAt: true, venue: true, status: true, scheduledByUserId: true, acknowledgedAt: true, acknowledgedByUserId: true, supersedesScheduleId: true, changeReason: true, createdAt: true } },
			attendances: { orderBy: { recordedAt: "asc" }, select: { id: true, scheduleId: true, outcome: true, recordedByUserId: true, recordedAt: true, remarks: true } },
		},
	});
	if (!item) throw new AppError(404, "Special case not found");
	let allowed = false;
	let assignedLecturer = false;
	if (role === "student") {
		const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
		allowed = item.submittedByUserId === userId || (!item.reportId && item.studentProfileId === student?.id);
	}
	if (role === "lecturer") allowed = item.submittedByUserId === userId;
	if (role === "lecturer") {
		const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
		assignedLecturer = Boolean(lecturer && item.report?.assignedLecturerProfileId === lecturer.id);
		if (!assignedLecturer && lecturer && !item.reportId && item.courseUnitId && item.academicPeriod) {
			const academicYear = academicYearForPeriod(item.academicPeriod);
			assignedLecturer = Boolean(academicYear && await db.courseUnitLecturer.findFirst({
				where: { courseUnitId: item.courseUnitId, lecturerProfileId: lecturer.id, academicYear, isActive: true },
				select: { id: true },
			}));
		}
		allowed ||= assignedLecturer;
	}
	if (role === "cod") {
		const department = item.report?.courseUnit.department ?? item.courseUnit?.department;
		if (!department) throw new AppError(404, "Special case not found");
		await requireValidDesignatedCodForReport(db, userId, department);
		allowed = true;
	}
	if (!allowed) throw new AppError(404, "Special case not found");
	const isCurrentAssignee = role === "lecturer" && assignedLecturer;
	return serializeCase(db, item, role === "cod" || role === "student" || isCurrentAssignee);
}

export async function getStudentSpecialCase({ db = prisma, userId, caseId }) {
	return getAuthorizedCase({ db, userId, role: "student", caseId });
}

export async function getLecturerSpecialCase({ db = prisma, userId, caseId }) {
	return getAuthorizedCase({ db, userId, role: "lecturer", caseId });
}

export async function listStudentSpecialCases({ db = prisma, userId, page, limit }) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Student profile not found");
	const p = pageArgs(page, limit);
	const where = { OR: [{ submittedByUserId: userId }, { reportId: null, studentProfileId: student.id }] };
	const [items, total] = await Promise.all([
		db.specialCase.findMany({
			where,
			skip: p.skip,
			take: p.limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true, reportId: true, studentProfileId: true, courseUnitId: true, academicPeriodId: true, assessmentId: true,
				categoryId: true, category: true, description: true, status: true, decisionAt: true, decisionReason: true,
				reviewDeadlineAt: true, submittedAt: true, schedulingDeadlineAt: true, administrativeResolutionRequired: true, createdAt: true,
				categoryRecord: { select: { id: true, code: true, name: true } },
				courseUnit: { select: { id: true, code: true, name: true } },
				academicPeriod: { select: { id: true, code: true, name: true } },
				assessment: { select: { id: true, code: true, name: true, type: true, assessmentDate: true } },
				reviews: { orderBy: { createdAt: "asc" }, select: { id: true, reviewerRole: true, action: true, decision: true, comments: true, createdAt: true } },
				schedules: { orderBy: { version: "asc" }, select: { id: true, version: true, startsAt: true, endsAt: true, venue: true, status: true, acknowledgedAt: true, createdAt: true } },
				attendances: { orderBy: { recordedAt: "asc" }, select: { id: true, outcome: true, recordedAt: true, remarks: true } },
			},
		}),
		db.specialCase.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function listLecturerSpecialCases({ db = prisma, userId, page, limit }) {
	const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!lecturer) throw new AppError(404, "Lecturer profile not found");
	const p = pageArgs(page, limit);
	const assignments = await db.courseUnitLecturer.findMany({
		where: { lecturerProfileId: lecturer.id, isActive: true },
		select: { courseUnitId: true, academicYear: true },
	});
	const standaloneAssignmentScopes = assignments.flatMap(({ courseUnitId, academicYear }) => {
		const bounds = academicYearBounds(academicYear);
		return bounds ? [{
			reportId: null,
			courseUnitId,
			academicPeriod: { startsAt: { gte: bounds.startsAt, lt: bounds.endsAt } },
		}] : [];
	});
	const where = { OR: [
		{ submittedByUserId: userId },
		{ report: { assignedLecturerProfileId: lecturer.id } },
		...standaloneAssignmentScopes,
	] };
	const [items, total] = await Promise.all([
		db.specialCase.findMany({
			where,
			skip: p.skip,
			take: p.limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true, reportId: true, studentProfileId: true, courseUnitId: true, academicPeriodId: true, assessmentId: true,
				categoryId: true, category: true, description: true, status: true, decisionAt: true, decisionReason: true,
				reviewDeadlineAt: true, submittedAt: true, schedulingDeadlineAt: true, administrativeResolutionRequired: true, createdAt: true,
				student: { select: { id: true, studentNumber: true, user: { select: { id: true, displayName: true } } } },
				courseUnit: { select: { id: true, code: true, name: true } },
				academicPeriod: { select: { id: true, code: true, name: true } },
				assessment: { select: { id: true, code: true, name: true, type: true, assessmentDate: true } },
				reviews: { orderBy: { createdAt: "asc" }, select: { id: true, reviewerUserId: true, reviewerRole: true, action: true, decision: true, comments: true, createdAt: true } },
			},
		}),
		db.specialCase.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function recommendStandaloneSpecialCase({ db = prisma, userId, caseId, recommendation, reason }) {
	if (!["RECOMMEND_APPROVAL", "RECOMMEND_REJECTION"].includes(recommendation)) {
		throw new AppError(422, "A valid lecturer recommendation is required");
	}
	if (typeof reason !== "string" || !reason.trim()) throw new AppError(422, "A recommendation reason is required");

	return db.$transaction(async (tx) => {
		const item = await tx.specialCase.findUnique({
			where: { id: caseId },
			select: {
				id: true, reportId: true, studentProfileId: true, courseUnitId: true, academicPeriodId: true,
				status: true, administrativeResolutionRequired: true,
				student: { select: { userId: true } },
				courseUnit: { select: { id: true, departmentId: true } },
				academicPeriod: { select: { startsAt: true, academicYear: true } },
			},
		});
		if (!item || item.reportId || !item.studentProfileId || !item.courseUnit || !item.academicPeriod) {
			throw new AppError(404, "Standalone special case not found");
		}
		if (item.status !== "PENDING_LECTURER_REVIEW") throw new AppError(409, "Special case is not awaiting lecturer review");
		const lecturer = await tx.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
		if (!lecturer) throw new AppError(404, "Assigned special case not found");
		const academicYear = academicYearForPeriod(item.academicPeriod);
		if (!academicYear) throw new AppError(409, "The academic period cannot be matched to a lecturer assignment");
		const assignment = await tx.courseUnitLecturer.findFirst({
			where: {
				courseUnitId: item.courseUnitId,
				lecturerProfileId: lecturer.id,
				academicYear,
				isActive: true,
				lecturer: { user: { isActive: true, approvalStatus: "APPROVED" } },
			},
			select: { id: true },
		});
		if (!assignment) throw new AppError(404, "Assigned special case not found");

		await lockDepartmentForReview(tx, item.courseUnit.departmentId);
		const department = await tx.department.findUnique({
			where: { id: item.courseUnit.departmentId },
			select: { id: true, designatedCodUserId: true },
		});
		if (!department) throw new AppError(404, "Assigned special case not found");
		if (!await validDesignatedCod(tx, department.id, department.designatedCodUserId)) {
			throw new AppError(409, "The department has no valid designated COD for final review");
		}
		const codUserId = department.designatedCodUserId;

		const nextStatus = "PENDING_COD_REVIEW";
		const update = await tx.specialCase.updateMany({
			where: {
				id: caseId,
				reportId: null,
				status: "PENDING_LECTURER_REVIEW",
			},
			data: { status: nextStatus, administrativeResolutionRequired: false },
		});
		if (update.count !== 1) throw new AppError(409, "Special case was reviewed concurrently");

		const review = await tx.specialCaseReview.create({
			data: {
				specialCaseId: caseId,
				reviewerUserId: userId,
				reviewerRole: "LECTURER",
				action: "RECOMMENDATION",
				decision: recommendation,
				comments: reason.trim(),
				previousStatus: item.status,
				newStatus: nextStatus,
			},
			select: { id: true, reviewerUserId: true, reviewerRole: true, action: true, decision: true, comments: true, createdAt: true },
		});
		await recordAuditEvent({
			prismaClient: tx,
			actorId: userId,
			action: "SPECIAL_CASE_LECTURER_RECOMMENDED",
			entityType: "SpecialCase",
			entityId: caseId,
			metadata: { recommendation, previousStatus: item.status, newStatus: nextStatus },
		});
		if (item.student?.userId) {
			await enqueueNotificationOnce(tx, {
				dedupeKey: `SPECIAL_CASE_LECTURER_RECOMMENDATION:${caseId}:STUDENT`,
				eventType: "SPECIAL_CASE_LECTURER_RECOMMENDATION",
				entityType: "SpecialCase",
				entityId: caseId,
				recipientUserId: item.student.userId,
				title: "Lecturer review completed",
				message: "Your special-case application has been forwarded for departmental review.",
			});
		}
		await enqueueNotificationOnce(tx, {
			dedupeKey: `SPECIAL_CASE_COD_REVIEW_REQUIRED:${caseId}:${codUserId}`,
			eventType: "SPECIAL_CASE_COD_REVIEW_REQUIRED",
			entityType: "SpecialCase",
			entityId: caseId,
			recipientUserId: codUserId,
			title: "Special case awaiting departmental review",
			message: `Special case ${caseId} is ready for a final decision.`,
		});
		return { id: caseId, status: nextStatus, review };
	});
}

export async function listCodSpecialCases({ db = prisma, userId, page, limit, status }) {
	const p = pageArgs(page, limit);
	const departmentIds = await validDesignatedDepartmentIds(db, userId);
	const where = {
		OR: [
			{ report: { courseUnit: { departmentId: { in: departmentIds } } } },
			{ reportId: null, courseUnit: { departmentId: { in: departmentIds } } },
		],
		...(status ? { status } : {}),
	};
	const [items, total] = await Promise.all([
		db.specialCase.findMany({
			where,
			skip: p.skip,
			take: p.limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true, reportId: true, submittedByUserId: true, studentProfileId: true, courseUnitId: true,
				academicPeriodId: true, assessmentId: true, categoryId: true, category: true, description: true,
				status: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, submittedAt: true,
				schedulingDeadlineAt: true, administrativeResolutionRequired: true, createdAt: true,
				student: { select: { id: true, studentNumber: true, user: { select: { id: true, displayName: true } } } },
				courseUnit: { select: { id: true, code: true, name: true, departmentId: true } },
				academicPeriod: { select: { id: true, code: true, name: true } },
				assessment: { select: { id: true, code: true, name: true, type: true, assessmentDate: true } },
				reviews: { orderBy: { createdAt: "asc" }, select: { id: true, reviewerUserId: true, reviewerRole: true, action: true, decision: true, comments: true, previousStatus: true, newStatus: true, createdAt: true } },
				schedules: { orderBy: { version: "asc" }, select: { id: true, version: true, startsAt: true, endsAt: true, venue: true, status: true, acknowledgedAt: true, createdAt: true } },
			},
		}),
		db.specialCase.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function listCodSpecialCaseSchedulingConfigs({ db = prisma, userId }) {
	const departmentIds = await validDesignatedDepartmentIds(db, userId);
	const departments = await db.department.findMany({
		where: { id: { in: departmentIds } },
		orderBy: { name: "asc" },
		select: {
			id: true,
			name: true,
			code: true,
			specialCaseConfig: { select: { schedulingDays: true, updatedAt: true } },
		},
	});
	return departments.map(({ specialCaseConfig, ...department }) => ({
		...department,
		schedulingDays: specialCaseConfig?.schedulingDays ?? null,
		updatedAt: specialCaseConfig?.updatedAt ?? null,
	}));
}

export async function saveCodSpecialCaseSchedulingConfig({ db = prisma, userId, departmentId, schedulingDays }) {
	if (!Number.isInteger(schedulingDays) || schedulingDays < 1 || schedulingDays > SPECIAL_CASE_SCHEDULING_DAYS_MAX) {
		throw new AppError(422, `Scheduling days must be an integer from 1 to ${SPECIAL_CASE_SCHEDULING_DAYS_MAX}`);
	}
	return db.$transaction(async (tx) => {
		await lockDepartmentForReview(tx, departmentId);
		const department = await tx.department.findUnique({
			where: { id: departmentId },
			select: { id: true, name: true, code: true, designatedCodUserId: true },
		});
		if (!department || department.designatedCodUserId !== userId || !await validDesignatedCod(tx, departmentId, userId)) {
			throw new AppError(404, "Department scheduling configuration not found");
		}
		const previous = await tx.specialCaseDepartmentConfig.findUnique({
			where: { departmentId },
			select: { schedulingDays: true },
		});
		const config = await tx.specialCaseDepartmentConfig.upsert({
			where: { departmentId },
			create: { departmentId, schedulingDays, updatedByUserId: userId },
			update: { schedulingDays, updatedByUserId: userId },
			select: { departmentId: true, schedulingDays: true, updatedByUserId: true, updatedAt: true },
		});
		await recordAuditEvent({
			prismaClient: tx,
			actorId: userId,
			action: previous ? "SPECIAL_CASE_SCHEDULING_CONFIG_UPDATED" : "SPECIAL_CASE_SCHEDULING_CONFIG_CREATED",
			entityType: "Department",
			entityId: departmentId,
			metadata: { previousSchedulingDays: previous?.schedulingDays ?? null, schedulingDays },
		});
		return { ...department, ...config };
	});
}

export async function getCodSpecialCase({ db = prisma, userId, caseId }) {
	return getAuthorizedCase({ db, userId, role: "cod", caseId });
}

async function findResponsibleLecturerUserId(tx, item) {
	const academicYear = academicYearForPeriod(item.academicPeriod);
	if (!academicYear || !item.courseUnitId) return null;
	const recommendation = await tx.specialCaseReview.findFirst({
		where: { specialCaseId: item.id, reviewerRole: "LECTURER", action: "RECOMMENDATION" },
		orderBy: { createdAt: "desc" },
		select: { reviewerUserId: true },
	});
	if (!recommendation) return null;
	const assignment = await tx.courseUnitLecturer.findFirst({
		where: {
			courseUnitId: item.courseUnitId,
			academicYear,
			isActive: true,
			lecturer: { user: { id: recommendation.reviewerUserId, isActive: true, approvalStatus: "APPROVED" } },
		},
		select: { id: true },
	});
	return assignment ? recommendation.reviewerUserId : null;
}

async function enqueueSpecialCaseSchedulingObligations(tx, { caseId, lecturerUserId, codUserId, deadlineAt, now }) {
	const reminderAt = new Date(Math.max(now.valueOf(), deadlineAt.valueOf() - 24 * 60 * 60 * 1000));
	const events = [
		{
			dedupeKey: `SPECIAL_CASE_SCHEDULING_REMINDER:${caseId}:${lecturerUserId}`,
			eventType: "SPECIAL_CASE_SCHEDULING_REMINDER",
			recipientUserId: lecturerUserId,
			title: "Special assessment scheduling deadline approaching",
			message: `Special case ${caseId} must be scheduled by ${deadlineAt.toISOString()}.`,
			availableAt: reminderAt,
		},
		{
			dedupeKey: `SPECIAL_CASE_SCHEDULING_OVERDUE:${caseId}:${lecturerUserId}`,
			eventType: "SPECIAL_CASE_SCHEDULING_OVERDUE",
			recipientUserId: lecturerUserId,
			title: "Special assessment scheduling overdue",
			message: `Special case ${caseId} is overdue for scheduling.`,
			availableAt: new Date(deadlineAt.valueOf() + 1),
		},
		{
			dedupeKey: `SPECIAL_CASE_COD_SCHEDULING_OVERDUE:${caseId}:${codUserId}`,
			eventType: "SPECIAL_CASE_COD_SCHEDULING_OVERDUE",
			recipientUserId: codUserId,
			title: "Special assessment scheduling overdue",
			message: `Special case ${caseId} remains unscheduled after its deadline.`,
			availableAt: new Date(deadlineAt.valueOf() + 1),
		},
	];
	for (const event of events) {
		await enqueueNotificationOnce(tx, {
			...event,
			entityType: "SpecialCase",
			entityId: caseId,
		});
	}
}

async function decideStandaloneSpecialCase({ tx, userId, caseId, item, decision, reason, now = new Date() }) {
	if (!["APPROVE", "REJECT"].includes(decision)) throw new AppError(422, "A valid final decision is required");
	if (typeof reason !== "string" || !reason.trim()) throw new AppError(422, "A decision reason is required");
	if (item.status !== "PENDING_COD_REVIEW") throw new AppError(409, "Special case is not awaiting a COD decision");
	if (item.administrativeResolutionRequired) throw new AppError(409, "The lecturer assignment must be resolved before a final decision");
	const lecturerRecommendation = await tx.specialCaseReview.findFirst({
		where: { specialCaseId: caseId, reviewerRole: "LECTURER", action: "RECOMMENDATION" },
		orderBy: { createdAt: "desc" },
		select: { id: true },
	});
	if (!lecturerRecommendation) throw new AppError(409, "A lecturer recommendation is required before the COD decision");

	const departmentId = item.courseUnit?.department.id;
	if (!departmentId) throw new AppError(404, "Special case not found");
	await lockDepartmentForReview(tx, departmentId);
	const department = await tx.department.findUnique({
		where: { id: departmentId },
		select: { id: true, designatedCodUserId: true },
	});
	if (!department || department.designatedCodUserId !== userId || !await validDesignatedCod(tx, departmentId, userId)) {
		throw new AppError(404, "Special case not found");
	}

	let schedulingDeadlineAt = null;
	const lecturerUserId = await findResponsibleLecturerUserId(tx, item);
	let nextStatus = "REJECTED";
	if (decision === "APPROVE") {
		const configuration = await tx.specialCaseDepartmentConfig.findUnique({
			where: { departmentId },
			select: { schedulingDays: true },
		});
		if (!configuration) throw new AppError(409, "Configure the departmental scheduling period before approving a special case");
		if (!lecturerUserId) throw new AppError(409, "A unique active lecturer assignment is required before scheduling can begin");
		schedulingDeadlineAt = new Date(now.valueOf() + configuration.schedulingDays * 24 * 60 * 60 * 1000);
		nextStatus = "PENDING_SCHEDULING";
	}

	const update = await tx.specialCase.updateMany({
		where: { id: caseId, reportId: null, status: item.status },
		data: {
			status: nextStatus,
			decisionByUserId: userId,
			decisionAt: now,
			decisionReason: reason.trim(),
			schedulingDeadlineAt,
		},
	});
	if (update.count !== 1) throw new AppError(409, "Special case was decided concurrently");

	const review = await tx.specialCaseReview.create({
		data: {
			specialCaseId: caseId,
			reviewerUserId: userId,
			reviewerRole: "COD",
			action: "FINAL_DECISION",
			decision,
			comments: reason.trim(),
			previousStatus: item.status,
			newStatus: nextStatus,
		},
		select: { id: true, reviewerUserId: true, reviewerRole: true, action: true, decision: true, comments: true, createdAt: true },
	});
	await recordAuditEvent({
		prismaClient: tx,
		actorId: userId,
		action: `SPECIAL_CASE_COD_${decision}`,
		entityType: "SpecialCase",
		entityId: caseId,
		metadata: { decision, previousStatus: item.status, newStatus: nextStatus, schedulingDeadlineAt },
	});
	if (item.student?.userId) {
		await enqueueNotificationOnce(tx, {
			dedupeKey: `SPECIAL_CASE_COD_DECISION:${caseId}:${item.student.userId}`,
			eventType: "SPECIAL_CASE_COD_DECISION",
			entityType: "SpecialCase",
			entityId: caseId,
			recipientUserId: item.student.userId,
			title: `Special-case application ${decision === "APPROVE" ? "approved" : "rejected"}`,
			message: decision === "APPROVE"
				? "Your application was approved. The lecturer will schedule a special assessment."
				: "A final decision has been recorded. View your application for the outcome and feedback.",
		});
	}
	if (lecturerUserId) {
		await enqueueNotificationOnce(tx, {
			dedupeKey: `SPECIAL_CASE_COD_DECISION:${caseId}:${lecturerUserId}`,
			eventType: "SPECIAL_CASE_COD_DECISION",
			entityType: "SpecialCase",
			entityId: caseId,
			recipientUserId: lecturerUserId,
			title: decision === "APPROVE" ? "Approved case awaiting scheduling" : "Special-case decision recorded",
			message: decision === "APPROVE"
				? `Special case ${caseId} is approved and must be scheduled by ${schedulingDeadlineAt.toISOString()}.`
				: `A final decision has been recorded for special case ${caseId}.`,
		});
		if (decision === "APPROVE") {
			await enqueueSpecialCaseSchedulingObligations(tx, {
				caseId,
				lecturerUserId,
				codUserId: userId,
				deadlineAt: schedulingDeadlineAt,
				now,
			});
		}
	}
	return {
		id: caseId,
		status: nextStatus,
		decision,
		decisionByUserId: userId,
		decisionAt: now,
		decisionReason: reason.trim(),
		schedulingDeadlineAt,
		review,
	};
}

export async function decideSpecialCase({ db = prisma, userId, caseId, decision, reason, now = new Date() }) {
	return db.$transaction(async (tx) => {
		const item = await tx.specialCase.findUnique({
			where: { id: caseId },
			select: {
				id: true, reportId: true, studentProfileId: true, courseUnitId: true, academicPeriodId: true,
				status: true, submittedByUserId: true, administrativeResolutionRequired: true,
				student: { select: { userId: true } },
				courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } },
				academicPeriod: { select: { startsAt: true, academicYear: true } },
				report: { select: { student: { select: { userId: true } }, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } } },
			},
		});
		if (!item) throw new AppError(404, "Special case not found");
		if (!item.reportId || !item.report) {
			return decideStandaloneSpecialCase({ tx, userId, caseId, item, decision, reason, now });
		}
		await requireValidDesignatedCodForReport(tx, userId, item.report.courseUnit.department);
		if (item.status.toUpperCase() !== "SUBMITTED") throw new AppError(409, "Special case has already received a final decision");
		const status = decision === "APPROVE" ? "Approved" : "Rejected";
		const result = await tx.specialCase.updateMany({ where: { id: caseId, status: item.status }, data: { status, decisionByUserId: userId, decisionAt: now, decisionReason: reason.trim() } });
		if (result.count !== 1) throw new AppError(409, "Special case was decided concurrently");
		const decided = await tx.specialCase.findUnique({ where: { id: caseId }, select: { id: true, reportId: true, status: true, decisionByUserId: true, decisionAt: true, decisionReason: true } });
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_DECIDED", entityType: "SpecialCase", entityId: caseId, metadata: { decision: status, reportId: item.reportId } });
		if (item.submittedByUserId) await createNotification({ prismaClient: tx, userId: item.submittedByUserId, reportId: item.reportId, title: `Special case ${status.toLowerCase()}`, message: `Your special case was ${status.toLowerCase()}. COD reason: ${reason.trim()}`, dedupeKey: `SPECIAL_CASE_DECISION:${caseId}` });
		return decided;
	});
}

async function lockStandaloneSpecialCase(tx, caseId) {
	const rows = await tx.$queryRaw`SELECT id FROM special_cases WHERE id = ${caseId}::uuid FOR UPDATE`;
	if (!rows.length) throw new AppError(404, "Special case not found");
}

async function lecturerWorkflowContext(tx, userId, caseId) {
	await lockStandaloneSpecialCase(tx, caseId);
	const item = await tx.specialCase.findUnique({
		where: { id: caseId },
		select: {
			id: true, reportId: true, studentProfileId: true, courseUnitId: true, academicPeriodId: true,
			status: true, administrativeResolutionRequired: true, schedulingDeadlineAt: true, student: { select: { userId: true } },
			academicPeriod: { select: { startsAt: true, academicYear: true } },
		},
	});
	if (!item || item.reportId || !item.studentProfileId || !item.academicPeriod || !item.courseUnitId) {
		throw new AppError(404, "Standalone special case not found");
	}
	if (item.administrativeResolutionRequired) throw new AppError(409, "The lecturer assignment must be resolved before this action");
	const lecturer = await tx.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
	const academicYear = academicYearForPeriod(item.academicPeriod);
	if (!lecturer || !academicYear) throw new AppError(404, "Assigned special case not found");
	const assignment = await tx.courseUnitLecturer.findFirst({
		where: {
			courseUnitId: item.courseUnitId,
			lecturerProfileId: lecturer.id,
			academicYear,
			isActive: true,
			lecturer: { user: { isActive: true, approvalStatus: "APPROVED" } },
		},
		select: { id: true },
	});
	if (!assignment) throw new AppError(404, "Assigned special case not found");
	return item;
}

function validatedScheduleTimes(startsAtValue, endsAtValue, now) {
	const startsAt = new Date(startsAtValue);
	const endsAt = new Date(endsAtValue);
	if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || startsAt <= now || endsAt <= startsAt) {
		throw new AppError(422, "Choose a future assessment time with an end time after the start time");
	}
	return { startsAt, endsAt };
}

async function notifyStudentOfSchedule(tx, { caseId, userId, schedule, rescheduled = false }) {
	if (!userId) return;
	await enqueueNotificationOnce(tx, {
		dedupeKey: `${rescheduled ? "SPECIAL_CASE_RESCHEDULED" : "SPECIAL_CASE_SCHEDULED"}:${caseId}:${schedule.id}:${userId}`,
		eventType: rescheduled ? "SPECIAL_CASE_ASSESSMENT_RESCHEDULED" : "SPECIAL_CASE_ASSESSMENT_SCHEDULED",
		entityType: "SpecialCase",
		entityId: caseId,
		recipientUserId: userId,
		title: rescheduled ? "Special assessment rescheduled" : "Special assessment scheduled",
		message: `Your assessment is scheduled for ${schedule.startsAt.toISOString()} at ${schedule.venue}. Please acknowledge the current schedule.`,
	});
}

export async function scheduleSpecialCase({
	db = prisma, userId, caseId, startsAt, endsAt, venue, now = new Date(),
}) {
	return db.$transaction(async (tx) => {
		const item = await lecturerWorkflowContext(tx, userId, caseId);
		if (item.status !== "PENDING_SCHEDULING") throw new AppError(409, "Only COD-approved cases awaiting scheduling can be scheduled");
		if (!item.schedulingDeadlineAt) throw new AppError(409, "The case has no configured scheduling deadline");
		if (now > item.schedulingDeadlineAt) throw new AppError(409, "The scheduling deadline has passed");
		const previousSchedule = await tx.specialCaseSchedule.findFirst({ where: { specialCaseId: caseId }, select: { id: true } });
		if (previousSchedule) throw new AppError(409, "The case already has scheduling history");
		const times = validatedScheduleTimes(startsAt, endsAt, now);
		const schedule = await tx.specialCaseSchedule.create({
			data: {
				specialCaseId: caseId,
				version: 1,
				...times,
				venue: venue.trim(),
				scheduledByUserId: userId,
			},
			select: { id: true, specialCaseId: true, version: true, startsAt: true, endsAt: true, venue: true, status: true, acknowledgedAt: true, createdAt: true },
		});
		const update = await tx.specialCase.updateMany({
			where: { id: caseId, status: "PENDING_SCHEDULING", reportId: null },
			data: { status: "SCHEDULED" },
		});
		if (update.count !== 1) throw new AppError(409, "Special case scheduling changed concurrently");
		await recordAuditEvent({
			prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_ASSESSMENT_SCHEDULED",
			entityType: "SpecialCase", entityId: caseId,
			metadata: { scheduleId: schedule.id, version: schedule.version, startsAt: schedule.startsAt, endsAt: schedule.endsAt, venue: schedule.venue },
		});
		await notifyStudentOfSchedule(tx, { caseId, userId: item.student?.userId, schedule });
		return { ...schedule, caseStatus: "SCHEDULED" };
	});
}

export async function rescheduleSpecialCase({
	db = prisma, userId, caseId, startsAt, endsAt, venue, reason, now = new Date(),
}) {
	if (typeof reason !== "string" || !reason.trim()) throw new AppError(422, "A rescheduling reason is required");
	return db.$transaction(async (tx) => {
		const item = await lecturerWorkflowContext(tx, userId, caseId);
		if (item.status !== "SCHEDULED") throw new AppError(409, "Only scheduled cases can be rescheduled");
		const current = await tx.specialCaseSchedule.findFirst({
			where: { specialCaseId: caseId, status: "SCHEDULED" },
			orderBy: { version: "desc" },
			select: { id: true, version: true, endsAt: true },
		});
		if (!current) throw new AppError(409, "The current assessment schedule is unavailable");
		if (current.endsAt <= now) throw new AppError(409, "An assessment cannot be rescheduled after its scheduled end time");
		const attendance = await tx.specialCaseAttendance.findUnique({ where: { scheduleId: current.id }, select: { id: true } });
		if (attendance) throw new AppError(409, "An assessment with recorded attendance cannot be rescheduled");
		const times = validatedScheduleTimes(startsAt, endsAt, now);
		const updateCurrent = await tx.specialCaseSchedule.updateMany({
			where: { id: current.id, status: "SCHEDULED" },
			data: { status: "RESCHEDULED" },
		});
		if (updateCurrent.count !== 1) throw new AppError(409, "The assessment schedule changed concurrently");
		const schedule = await tx.specialCaseSchedule.create({
			data: {
				specialCaseId: caseId,
				version: current.version + 1,
				...times,
				venue: venue.trim(),
				scheduledByUserId: userId,
				supersedesScheduleId: current.id,
				changeReason: reason.trim(),
			},
			select: { id: true, specialCaseId: true, version: true, startsAt: true, endsAt: true, venue: true, status: true, acknowledgedAt: true, supersedesScheduleId: true, changeReason: true, createdAt: true },
		});
		await tx.specialCase.update({ where: { id: caseId }, data: { authorizedReschedules: { increment: 1 } }, select: { id: true } });
		await recordAuditEvent({
			prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_ASSESSMENT_RESCHEDULED",
			entityType: "SpecialCase", entityId: caseId,
			metadata: { previousScheduleId: current.id, scheduleId: schedule.id, version: schedule.version, reason: reason.trim(), startsAt: schedule.startsAt, endsAt: schedule.endsAt, venue: schedule.venue },
		});
		await notifyStudentOfSchedule(tx, { caseId, userId: item.student?.userId, schedule, rescheduled: true });
		return schedule;
	});
}

export async function cancelSpecialCase({ db = prisma, userId, caseId, reason, now = new Date() }) {
	if (typeof reason !== "string" || !reason.trim()) throw new AppError(422, "A cancellation reason is required");
	return db.$transaction(async (tx) => {
		const item = await lecturerWorkflowContext(tx, userId, caseId);
		if (!["PENDING_SCHEDULING", "SCHEDULED"].includes(item.status)) {
			throw new AppError(409, "Only approved cases awaiting or having a schedule can be cancelled");
		}
		const current = item.status === "SCHEDULED" ? await tx.specialCaseSchedule.findFirst({
			where: { specialCaseId: caseId, status: "SCHEDULED" },
			orderBy: { version: "desc" },
			select: { id: true, endsAt: true },
		}) : null;
		if (current?.endsAt <= now) throw new AppError(409, "An assessment cannot be cancelled after its scheduled end time");
		if (current) {
			await tx.specialCaseSchedule.updateMany({ where: { id: current.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
		}
		const nextStatus = "CANCELLED";
		const update = await tx.specialCase.updateMany({ where: { id: caseId, status: item.status }, data: { status: nextStatus } });
		if (update.count !== 1) throw new AppError(409, "Special case changed concurrently");
		await tx.specialCaseReview.create({
			data: {
				specialCaseId: caseId, reviewerUserId: userId, reviewerRole: "LECTURER",
				action: "CANCELLED", comments: reason.trim(), previousStatus: item.status, newStatus: nextStatus,
			},
		});
		await recordAuditEvent({
			prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_CANCELLED",
			entityType: "SpecialCase", entityId: caseId,
			metadata: { previousStatus: item.status, newStatus: nextStatus, scheduleId: current?.id ?? null, reason: reason.trim() },
		});
		if (item.student?.userId) {
			await enqueueNotificationOnce(tx, {
				dedupeKey: `SPECIAL_CASE_CANCELLED:${caseId}:${item.student.userId}`,
				eventType: "SPECIAL_CASE_ASSESSMENT_CANCELLED",
				entityType: "SpecialCase",
				entityId: caseId,
				recipientUserId: item.student.userId,
				title: "Special assessment cancelled",
				message: "Your special-case assessment has been cancelled. View your application for details.",
			});
		}
		return { id: caseId, status: nextStatus };
	});
}

export async function recordSpecialCaseAttendance({ db = prisma, userId, caseId, outcome, remarks, now = new Date() }) {
	if (!["ATTENDED", "DID_NOT_ATTEND"].includes(outcome)) throw new AppError(422, "A valid attendance outcome is required");
	return db.$transaction(async (tx) => {
		const item = await lecturerWorkflowContext(tx, userId, caseId);
		if (item.status !== "SCHEDULED") throw new AppError(409, "Attendance can only be recorded for a scheduled case");
		const schedule = await tx.specialCaseSchedule.findFirst({
			where: { specialCaseId: caseId, status: "SCHEDULED" },
			orderBy: { version: "desc" },
			select: { id: true, endsAt: true },
		});
		if (!schedule) throw new AppError(409, "The current assessment schedule is unavailable");
		if (schedule.endsAt > now) throw new AppError(409, "Attendance cannot be recorded before the scheduled assessment ends");
		const existingAttendance = await tx.specialCaseAttendance.findUnique({ where: { scheduleId: schedule.id }, select: { id: true } });
		if (existingAttendance) throw new AppError(409, "Attendance has already been recorded for this assessment");
		const attendance = await tx.specialCaseAttendance.create({
			data: {
				specialCaseId: caseId,
				scheduleId: schedule.id,
				outcome,
				recordedByUserId: userId,
				remarks: remarks?.trim() || null,
				recordedAt: now,
			},
			select: { id: true, specialCaseId: true, scheduleId: true, outcome: true, recordedByUserId: true, recordedAt: true, remarks: true },
		});
		const nextStatus = outcome === "ATTENDED" ? "COMPLETED" : "DID_NOT_ATTEND";
		const update = await tx.specialCase.updateMany({
			where: { id: caseId, status: "SCHEDULED" },
			data: { status: nextStatus },
		});
		if (update.count !== 1) throw new AppError(409, "Attendance was recorded concurrently");
		await recordAuditEvent({
			prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_ATTENDANCE_RECORDED",
			entityType: "SpecialCase", entityId: caseId,
			metadata: { scheduleId: schedule.id, outcome, newStatus: nextStatus },
		});
		if (item.student?.userId) {
			await enqueueNotificationOnce(tx, {
				dedupeKey: `SPECIAL_CASE_ATTENDANCE:${caseId}:${attendance.id}:${item.student.userId}`,
				eventType: outcome === "ATTENDED" ? "SPECIAL_CASE_ASSESSMENT_COMPLETED" : "SPECIAL_CASE_ASSESSMENT_DID_NOT_ATTEND",
				entityType: "SpecialCase",
				entityId: caseId,
				recipientUserId: item.student.userId,
				title: outcome === "ATTENDED" ? "Special assessment completed" : "Special assessment non-attendance recorded",
				message: outcome === "ATTENDED"
					? "The lecturer recorded your special assessment as attended and completed."
					: "The lecturer recorded that you did not attend the scheduled special assessment.",
			});
		}
		if (outcome === "DID_NOT_ATTEND") {
			const department = await tx.courseUnit.findUnique({
				where: { id: item.courseUnitId },
				select: { department: { select: { id: true, designatedCodUserId: true } } },
			});
			const codUserId = department?.department?.designatedCodUserId;
			if (codUserId && await validDesignatedCod(tx, department.department.id, codUserId)) {
				await enqueueNotificationOnce(tx, {
					dedupeKey: `SPECIAL_CASE_NON_ATTENDANCE:${caseId}:${codUserId}`,
					eventType: "SPECIAL_CASE_NON_ATTENDANCE_REQUIRES_RESOLUTION",
					entityType: "SpecialCase",
					entityId: caseId,
					recipientUserId: codUserId,
					title: "Special case requires non-attendance resolution",
					message: `Special case ${caseId} was not attended and requires departmental review.`,
				});
			}
		}
		return { ...attendance, caseStatus: nextStatus };
	});
}

export async function acknowledgeSpecialCaseSchedule({ db = prisma, userId, caseId, now = new Date() }) {
	return db.$transaction(async (tx) => {
		await lockStandaloneSpecialCase(tx, caseId);
		const student = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true } });
		if (!student) throw new AppError(404, "Special case not found");
		const item = await tx.specialCase.findFirst({
			where: { id: caseId, reportId: null, studentProfileId: student.id },
			select: { id: true, status: true },
		});
		if (!item) throw new AppError(404, "Special case not found");
		if (item.status !== "SCHEDULED") throw new AppError(409, "Only a current scheduled assessment can be acknowledged");
		const schedule = await tx.specialCaseSchedule.findFirst({
			where: { specialCaseId: caseId, status: "SCHEDULED" },
			orderBy: { version: "desc" },
			select: { id: true, startsAt: true, endsAt: true, venue: true, acknowledgedAt: true, acknowledgedByUserId: true },
		});
		if (!schedule) throw new AppError(409, "The current assessment schedule is unavailable");
		if (schedule.acknowledgedAt) throw new AppError(409, "This schedule has already been acknowledged");
		const updated = await tx.specialCaseSchedule.updateMany({
			where: { id: schedule.id, status: "SCHEDULED", acknowledgedAt: null },
			data: { acknowledgedAt: now, acknowledgedByUserId: userId },
		});
		if (updated.count !== 1) throw new AppError(409, "The assessment schedule changed concurrently");
		await recordAuditEvent({
			prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_SCHEDULE_ACKNOWLEDGED",
			entityType: "SpecialCase", entityId: caseId,
			metadata: { scheduleId: schedule.id, acknowledgedAt: now },
		});
		return { ...schedule, acknowledgedAt: now, acknowledgedByUserId: userId };
	});
}

export async function listStudentAppeals({ db = prisma, userId, page, limit }) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Student profile not found");
	const p = pageArgs(page, limit);
	const where = { studentProfileId: student.id };
	const [items, total] = await Promise.all([
		db.appeal.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, reportId: true, reason: true, comments: true, status: true, decisionAt: true, decisionReason: true, createdAt: true, evidence: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mediaType: true, sizeBytes: true, createdAt: true } } } }),
		db.appeal.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function getStudentAppeal({ db = prisma, userId, appealId }) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Appeal not found");
	const item = await db.appeal.findFirst({ where: { id: appealId, studentProfileId: student.id }, select: { id: true, reportId: true, reason: true, comments: true, status: true, decisionAt: true, decisionReason: true, createdAt: true, evidence: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mediaType: true, sizeBytes: true, createdAt: true } } } });
	if (!item) throw new AppError(404, "Appeal not found");
	return item;
}

export async function listCodAppeals({ db = prisma, userId, page, limit, status }) {
	const p = pageArgs(page, limit);
	const departmentIds = await validDesignatedDepartmentIds(db, userId);
	const where = { report: { courseUnit: { departmentId: { in: departmentIds } } }, ...(status ? { status } : {}) };
	const [items, total] = await Promise.all([
		db.appeal.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, reportId: true, studentProfileId: true, reason: true, comments: true, status: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, createdAt: true, report: { select: { reference: true, status: true, courseUnit: { select: { departmentId: true } } } } } }),
		db.appeal.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function getCodAppeal({ db = prisma, userId, appealId }) {
	const item = await db.appeal.findUnique({
		where: { id: appealId },
		select: {
			id: true, reportId: true, studentProfileId: true, reason: true, comments: true, status: true,
			decisionByUserId: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, createdAt: true,
			evidence: { orderBy: { createdAt: "asc" }, select: { id: true, originalName: true, mediaType: true, sizeBytes: true, createdAt: true, uploadedBy: { select: { id: true, displayName: true } } } },
			report: {
				select: {
					status: true,
					statusHistory: {
						orderBy: { createdAt: "asc" },
						select: { previousStatus: true, newStatus: true, reason: true, createdAt: true, actor: { select: { displayName: true } } },
					},
					courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } },
				},
			},
		},
	});
	if (!item) throw new AppError(404, "Appeal not found");
	await requireValidDesignatedCodForReport(db, userId, item.report.courseUnit.department);
	return item;
}

export async function decideAppeal({ db = prisma, userId, appealId, decision, reason }) {
	return db.$transaction(async (tx) => {
		const appeal = await tx.appeal.findUnique({ where: { id: appealId }, select: { id: true, reportId: true, status: true, studentProfileId: true, report: { select: { status: true, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } }, student: { select: { userId: true } } } } } });
		if (!appeal) throw new AppError(404, "Appeal not found");
		await requireValidDesignatedCodForReport(tx, userId, appeal.report.courseUnit.department);
		if (appeal.status.toUpperCase() !== "SUBMITTED") throw new AppError(409, "Appeal has already received a final decision");
		if (appeal.report.status.toUpperCase() !== "REJECTED") throw new AppError(409, "Appeal report is no longer rejected");
		const status = decision === "APPROVE" ? "Approved" : "Rejected";
		const decisionAt = new Date();
		const updateAppeal = await tx.appeal.updateMany({ where: { id: appealId, status: appeal.status }, data: { status, decisionByUserId: userId, decisionAt, decisionReason: reason.trim() } });
		if (updateAppeal.count !== 1) throw new AppError(409, "Appeal was decided concurrently");
		let history = null;
		if (decision === "APPROVE") {
			const updateReport = await tx.missingMarkReport.updateMany({ where: { id: appeal.reportId, status: "REJECTED" }, data: { status: "PENDING" } });
			if (updateReport.count !== 1) throw new AppError(409, "Report state changed; reload the appeal before deciding");
			history = await tx.reportStatusHistory.create({ data: { reportId: appeal.reportId, actorUserId: userId, previousStatus: "REJECTED", newStatus: "PENDING", reason: `Appeal approved: ${reason.trim()}` }, select: { id: true, previousStatus: true, newStatus: true, reason: true, createdAt: true } });
		}
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: `REPORT_APPEAL_${status.toUpperCase()}`, entityType: "Appeal", entityId: appealId, metadata: { reportId: appeal.reportId, decision: status } });
		await createNotification({ prismaClient: tx, userId: appeal.report.student.userId, reportId: appeal.reportId, title: `Appeal ${status.toLowerCase()}`, message: `Your appeal was ${status.toLowerCase()}. COD reason: ${reason.trim()}`, dedupeKey: `APPEAL_DECISION:${appealId}` });
		return { appealId, reportId: appeal.reportId, status, decisionAt, decisionReason: reason.trim(), reportStatus: decision === "APPROVE" ? "PENDING" : "REJECTED", history };
	});
}

export async function listOverdue({ db = prisma, userId, kind, page, limit }) {
	const p = pageArgs(page, limit);
	const now = new Date();
	const departmentIds = await validDesignatedDepartmentIds(db, userId);
	const where = kind === "appeals"
		? { status: "Submitted", reviewDeadlineAt: { lt: now }, report: { courseUnit: { departmentId: { in: departmentIds } } } }
		: {
			OR: [
				{ status: "Submitted", reviewDeadlineAt: { lt: now }, report: { courseUnit: { departmentId: { in: departmentIds } } } },
				{ status: "PENDING_SCHEDULING", schedulingDeadlineAt: { lt: now }, reportId: null, courseUnit: { departmentId: { in: departmentIds } } },
			],
		};
	const model = kind === "appeals" ? db.appeal : db.specialCase;
	const [items, total] = await Promise.all([
		model.findMany({
			where,
			skip: p.skip,
			take: p.limit,
			orderBy: kind === "appeals" ? { reviewDeadlineAt: "asc" } : [{ schedulingDeadlineAt: "asc" }, { reviewDeadlineAt: "asc" }],
			select: {
				id: true, reportId: true, status: true, reviewDeadlineAt: true, createdAt: true,
				...(kind === "appeals" ? {} : { schedulingDeadlineAt: true }),
			},
		}),
		model.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function listPublicHolidays({ db = prisma, from, to }) {
	const where = { ...(from || to ? { date: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}) } } : {}) };
	return db.publicHoliday.findMany({ where, select: { id: true, date: true, name: true, source: true, description: true }, orderBy: { date: "asc" } });
}

export async function savePublicHoliday({ db = prisma, userId, id, date, name, source, description, remove = false }) {
	return db.$transaction(async (tx) => {
		let result;
		if (id && remove) {
			result = await tx.publicHoliday.delete({ where: { id } });
		} else if (id) {
			result = await tx.publicHoliday.update({ where: { id }, data: { date: new Date(`${date}T00:00:00.000Z`), name, source: source ?? null, description: description ?? null, managedByUserId: userId } });
		} else {
			result = await tx.publicHoliday.create({ data: { date: new Date(`${date}T00:00:00.000Z`), name, source: source ?? null, description: description ?? null, managedByUserId: userId } });
		}
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: remove ? "PUBLIC_HOLIDAY_DELETED" : id ? "PUBLIC_HOLIDAY_UPDATED" : "PUBLIC_HOLIDAY_CREATED", entityType: "PublicHoliday", entityId: result.id, metadata: { date: result.date.toISOString().slice(0, 10), name: result.name } });
		return result;
	});
}
