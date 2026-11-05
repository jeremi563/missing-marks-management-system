import { prisma } from "../../config/database.js";
import { addWorkingDays } from "../utils/business-days.js";
import { AppError } from "../utils/app-error.js";
import { recordAuditEvent } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { enqueueNotificationOnce } from "./notification-outbox.service.js";
import { lockDepartmentForReview } from "./department-review-lock.service.js";

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;

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

async function requireDesignatedCod(db, userId, reportId) {
	const report = await reportContext(db, reportId);
	if (report.courseUnit.department.designatedCodUserId !== userId) throw new AppError(403, "You are not the designated COD for this report's department");
	return report;
}

async function validDesignatedCod(db, departmentId, userId) {
	if (!userId) return false;
	const user = await db.user.findFirst({
		where: { id: userId, isActive: true, roles: { some: { role: { name: "cod" } } }, departmentMemberships: { some: { departmentId } } },
		select: { id: true },
	});
	return Boolean(user);
}

async function requireValidDepartmentCod(db, department) {
	if (!await validDesignatedCod(db, department.id, department.designatedCodUserId)) {
		throw new AppError(409, "This department currently has no valid designated COD, so the submission cannot proceed");
	}
	return department.designatedCodUserId;
}

async function validDesignatedDepartmentIds(db, userId) {
	const departments = await db.department.findMany({ where: { designatedCodUserId: userId }, select: { id: true } });
	const valid = [];
	for (const department of departments) if (await validDesignatedCod(db, department.id, userId)) valid.push(department.id);
	return valid;
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

export async function createSpecialCase({ db = prisma, userId, role, reportId, categoryId, description }) {
	return db.$transaction(async (tx) => {
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
		await enqueueCodOverdue(tx, {
			entityType: "SpecialCase", entityId: specialCase.id, reportId,
			recipientUserId: report.courseUnit.department.designatedCodUserId,
			deadlineAt: reviewDeadlineAt, title: "Special case review overdue",
			message: `Special case ${specialCase.id} is awaiting a departmental decision.`,
		});
		return specialCase;
	});
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
		const codUserId = await validDesignatedCod(tx, report.courseUnit.department.id, report.courseUnit.department.designatedCodUserId)
			? report.courseUnit.department.designatedCodUserId
			: null;
		const overdueAt = new Date(deadlineAt.valueOf() + 1);
		await enqueueNotificationOnce(tx, { dedupeKey: `LECTURER_${key}:${profile.userId}`, eventType: "LECTURER_REPORT_OVERDUE", entityType: "MissingMarkReport", entityId: reportId, recipientUserId: profile.userId, reportId, title: "Assigned report overdue", message: `Report ${reportId} has passed its lecturer decision deadline.`, availableAt: overdueAt });
		if (codUserId) await enqueueNotificationOnce(tx, { dedupeKey: `COD_${key}:${codUserId}`, eventType: "COD_REPORT_OVERDUE", entityType: "MissingMarkReport", entityId: reportId, recipientUserId: codUserId, reportId, title: "Lecturer report overdue", message: `Report ${reportId} has passed its lecturer decision deadline.`, availableAt: overdueAt });
		return { reportId, assignmentId: assignment.id, workStartedAt: startedAt, deadlineAt };
	});
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
		const codUser = await tx.user.findFirst({ where: { id: codUserId, isActive: true, roles: { some: { role: { name: "cod" } } }, departmentMemberships: { some: { departmentId } } }, select: { id: true } });
		if (!codUser) throw new AppError(422, "Designated COD must be active, have the cod role and belong to the department");
		const result = await tx.department.update({ where: { id: departmentId }, data: { designatedCodUserId: codUserId }, select: { id: true, name: true, code: true, designatedCodUserId: true } });
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "DEPARTMENT_COD_DESIGNATED", entityType: "Department", entityId: departmentId, metadata: { designatedCodUserId: codUserId } });
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
	const reports = await tx.missingMarkReport.findMany({
		where: { status: "PENDING", courseUnit: { departmentId } },
		select: { id: true, reference: true, assignedLecturerProfileId: true, assignments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, deadlineAt: true, workStartedAt: true, newLecturerProfileId: true } } },
	});
	for (const report of reports) {
		const assignment = report.assignments[0];
		if (assignment?.workStartedAt && assignment.deadlineAt && assignment.newLecturerProfileId === report.assignedLecturerProfileId) {
			await enqueueNotificationOnce(tx, {
				eventType: "COD_REPORT_OVERDUE", entityType: "MissingMarkReport", entityId: report.id, reportId: report.id, recipientUserId: codUserId,
				dedupeKey: `COD_REPORT_OVERDUE:${assignment.id}:${codUserId}`,
				deadlineAt: assignment.deadlineAt, title: "Lecturer report overdue", message: `Report ${report.id} has passed its lecturer decision deadline.`,
				availableAt: new Date(assignment.deadlineAt.valueOf() + 1),
			});
		}
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
			id: true, reportId: true, submittedByUserId: true, categoryId: true, category: true, description: true, status: true,
			decisionByUserId: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, createdAt: true,
			categoryRecord: { select: { id: true, code: true, name: true, isActive: true } },
			report: { select: { assignedLecturerProfileId: true, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } } },
		},
	});
	if (!item) throw new AppError(404, "Special case not found");
	let allowed = false;
	if (role === "student" || role === "lecturer") allowed = item.submittedByUserId === userId;
	if (role === "lecturer") {
		const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
		allowed ||= lecturer?.id === item.report.assignedLecturerProfileId;
	}
	if (role === "cod") {
		await requireValidDesignatedCodForReport(db, userId, item.report.courseUnit.department);
		allowed = true;
	}
	if (!allowed) throw new AppError(404, "Special case not found");
	const isCurrentAssignee = role === "lecturer" && await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } }).then((lecturer) => lecturer?.id === item.report.assignedLecturerProfileId);
	return serializeCase(db, item, role === "cod" || isCurrentAssignee);
}

export async function getStudentSpecialCase({ db = prisma, userId, caseId }) {
	return getAuthorizedCase({ db, userId, role: "student", caseId });
}

export async function getLecturerSpecialCase({ db = prisma, userId, caseId }) {
	return getAuthorizedCase({ db, userId, role: "lecturer", caseId });
}

export async function listStudentSpecialCases({ db = prisma, userId, page, limit }) {
	const p = pageArgs(page, limit);
	const where = { submittedByUserId: userId };
	const [items, total] = await Promise.all([
		db.specialCase.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, reportId: true, categoryId: true, category: true, description: true, status: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, createdAt: true } }),
		db.specialCase.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function listLecturerSpecialCases({ db = prisma, userId, page, limit }) {
	const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!lecturer) throw new AppError(404, "Lecturer profile not found");
	const p = pageArgs(page, limit);
	const where = { OR: [
		{ submittedByUserId: userId },
		{ report: { assignedLecturerProfileId: lecturer.id } },
	] };
	const [items, total] = await Promise.all([
		db.specialCase.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, reportId: true, categoryId: true, category: true, description: true, status: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, createdAt: true } }),
		db.specialCase.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function listCodSpecialCases({ db = prisma, userId, page, limit, status }) {
	const p = pageArgs(page, limit);
	const departmentIds = await validDesignatedDepartmentIds(db, userId);
	const where = { report: { courseUnit: { departmentId: { in: departmentIds } } }, ...(status ? { status } : {}) };
	const [items, total] = await Promise.all([
		db.specialCase.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, reportId: true, submittedByUserId: true, categoryId: true, category: true, description: true, status: true, decisionAt: true, decisionReason: true, reviewDeadlineAt: true, createdAt: true, report: { select: { reference: true, status: true, courseUnit: { select: { departmentId: true } } } } } }),
		db.specialCase.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function getCodSpecialCase({ db = prisma, userId, caseId }) {
	return getAuthorizedCase({ db, userId, role: "cod", caseId });
}

export async function decideSpecialCase({ db = prisma, userId, caseId, decision, reason }) {
	return db.$transaction(async (tx) => {
		const item = await tx.specialCase.findUnique({ where: { id: caseId }, select: { id: true, reportId: true, status: true, submittedByUserId: true, report: { select: { student: { select: { userId: true } }, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } } } } });
		if (!item) throw new AppError(404, "Special case not found");
		await requireValidDesignatedCodForReport(tx, userId, item.report.courseUnit.department);
		if (item.status.toUpperCase() !== "SUBMITTED") throw new AppError(409, "Special case has already received a final decision");
		const status = decision === "APPROVE" ? "Approved" : "Rejected";
		const result = await tx.specialCase.updateMany({ where: { id: caseId, status: item.status }, data: { status, decisionByUserId: userId, decisionAt: new Date(), decisionReason: reason.trim() } });
		if (result.count !== 1) throw new AppError(409, "Special case was decided concurrently");
		const decided = await tx.specialCase.findUnique({ where: { id: caseId }, select: { id: true, reportId: true, status: true, decisionByUserId: true, decisionAt: true, decisionReason: true } });
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "SPECIAL_CASE_DECIDED", entityType: "SpecialCase", entityId: caseId, metadata: { decision: status, reportId: item.reportId } });
		if (item.submittedByUserId) await createNotification({ prismaClient: tx, userId: item.submittedByUserId, reportId: item.reportId, title: `Special case ${status.toLowerCase()}`, message: `Your special case was ${status.toLowerCase()}. COD reason: ${reason.trim()}`, dedupeKey: `SPECIAL_CASE_DECISION:${caseId}` });
		return decided;
	});
}

export async function listStudentAppeals({ db = prisma, userId, page, limit }) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Student profile not found");
	const p = pageArgs(page, limit);
	const where = { studentProfileId: student.id };
	const [items, total] = await Promise.all([
		db.appeal.findMany({ where, skip: p.skip, take: p.limit, orderBy: { createdAt: "desc" }, select: { id: true, reportId: true, reason: true, comments: true, status: true, decisionAt: true, decisionReason: true, createdAt: true } }),
		db.appeal.count({ where }),
	]);
	return { items, pagination: { page: p.page, limit: p.limit, total, totalPages: Math.ceil(total / p.limit) } };
}

export async function getStudentAppeal({ db = prisma, userId, appealId }) {
	const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!student) throw new AppError(404, "Appeal not found");
	const item = await db.appeal.findFirst({ where: { id: appealId, studentProfileId: student.id }, select: { id: true, reportId: true, reason: true, comments: true, status: true, decisionAt: true, decisionReason: true, createdAt: true } });
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
	if (kind === "reports") {
		const all = await db.missingMarkReport.findMany({ where: { status: "PENDING", assignedLecturerProfileId: { not: null }, courseUnit: { departmentId: { in: departmentIds } } }, orderBy: { createdAt: "desc" }, select: { id: true, reference: true, status: true, assignedLecturerProfileId: true, courseUnit: { select: { departmentId: true } }, assignments: { orderBy: { createdAt: "desc" }, take: 1, select: { newLecturerProfileId: true, workStartedAt: true, deadlineAt: true } } } });
		const overdue = all.filter((item) => {
			const assignment = item.assignments[0];
			return assignment?.newLecturerProfileId === item.assignedLecturerProfileId && assignment.workStartedAt && assignment.deadlineAt < now;
		});
		const items = overdue.slice(p.skip, p.skip + p.limit);
		return { items, pagination: { page: p.page, limit: p.limit, total: overdue.length, totalPages: Math.ceil(overdue.length / p.limit) } };
	}
	const where = { status: "Submitted", reviewDeadlineAt: { lt: now }, report: { courseUnit: { departmentId: { in: departmentIds } } } };
	const model = kind === "appeals" ? db.appeal : db.specialCase;
	const [items, total] = await Promise.all([
		model.findMany({ where, skip: p.skip, take: p.limit, orderBy: { reviewDeadlineAt: "asc" }, select: { id: true, reportId: true, status: true, reviewDeadlineAt: true, createdAt: true } }),
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

