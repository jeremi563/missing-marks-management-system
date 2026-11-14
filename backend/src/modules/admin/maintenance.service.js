import { prisma } from "../../config/database.js";
import { lockDepartmentForReview } from "../../shared/services/department-review-lock.service.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { AppError } from "../../shared/utils/app-error.js";
import { academicYearForPeriod } from "../../shared/utils/academic-year.js";

async function loadReport(tx, reportId) {
	const report = await tx.missingMarkReport.findUnique({
		where: { id: reportId },
		select: {
			id: true,
			status: true,
			assignedLecturerProfileId: true,
			courseUnitId: true,
			courseUnit: { select: { departmentId: true } },
			academicPeriod: { select: { name: true, code: true, startsAt: true } },
		},
	});
	if (!report) throw new AppError(404, "Missing-mark report not found");
	return report;
}

async function rejectOpenReviews(tx, reportId) {
	const [appeal, specialCase] = await Promise.all([
		tx.appeal.findFirst({ where: { reportId, status: "Submitted" }, select: { id: true } }),
		tx.specialCase.findFirst({ where: { reportId, status: "Submitted" }, select: { id: true } }),
	]);
	if (appeal || specialCase) throw new AppError(409, "Resolve the open appeal or special case before performing report maintenance");
}

async function eligibleLecturer(tx, courseUnitId, lecturerProfileId, academicYear) {
	return tx.lecturerProfile.findFirst({
		where: {
			id: lecturerProfileId,
			user: { isActive: true, roles: { some: { role: { name: "lecturer" } } } },
			unitAssignments: { some: { courseUnitId, academicYear } },
		},
		select: { id: true },
	});
}

export async function reopenReport({ db = prisma, actorUserId, reportId, reason }) {
	return db.$transaction(async (tx) => {
		const initial = await loadReport(tx, reportId);
		await lockDepartmentForReview(tx, initial.courseUnit.departmentId);
		const report = await loadReport(tx, reportId);
		if (!["REJECTED", "WITHDRAWN"].includes(report.status.toUpperCase())) throw new AppError(409, "Only rejected or withdrawn reports may be reopened");
		await rejectOpenReviews(tx, reportId);
		const updated = await tx.missingMarkReport.updateMany({ where: { id: reportId, status: report.status }, data: { status: "PENDING", assignedLecturerProfileId: null } });
		if (updated.count !== 1) throw new AppError(409, "Report state changed; reload before reopening");
		const history = await tx.reportStatusHistory.create({ data: { reportId, actorUserId, previousStatus: report.status, newStatus: "PENDING", reason } });
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_REPORT_REOPENED", entityType: "MissingMarkReport", entityId: reportId, metadata: { previousStatus: report.status, newStatus: "PENDING" } });
		return { reportId, status: "PENDING", history };
	});
}

export async function reassignReport({ db = prisma, actorUserId, reportId, lecturerProfileId, reason }) {
	return db.$transaction(async (tx) => {
		const initial = await loadReport(tx, reportId);
		await lockDepartmentForReview(tx, initial.courseUnit.departmentId);
		const report = await loadReport(tx, reportId);
		if (["APPROVED", "REJECTED", "WITHDRAWN"].includes(report.status.toUpperCase())) throw new AppError(409, "Only unresolved reports may be reassigned");
		await rejectOpenReviews(tx, reportId);
		const academicYear = academicYearForPeriod(report.academicPeriod);
		if (!academicYear || !await eligibleLecturer(tx, report.courseUnitId, lecturerProfileId, academicYear)) {
			throw new AppError(422, "Selected lecturer is not active, has the lecturer role, or is not assigned to this course unit for the report's academic year");
		}
		if (report.assignedLecturerProfileId === lecturerProfileId) throw new AppError(409, "Report is already assigned to this lecturer");
		const updated = await tx.missingMarkReport.updateMany({ where: { id: reportId, status: report.status, assignedLecturerProfileId: report.assignedLecturerProfileId }, data: { assignedLecturerProfileId: lecturerProfileId, status: report.status.toUpperCase() === "SUBMITTED" ? "PENDING" : report.status } });
		if (updated.count !== 1) throw new AppError(409, "Report assignment changed; reload before reassigning");
		const assignment = await tx.reportAssignment.create({ data: { reportId, actorUserId, previousLecturerProfileId: report.assignedLecturerProfileId, newLecturerProfileId: lecturerProfileId, reason } });
		if (report.status.toUpperCase() === "SUBMITTED") await tx.reportStatusHistory.create({ data: { reportId, actorUserId, previousStatus: report.status, newStatus: "PENDING", reason } });
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_REPORT_REASSIGNED", entityType: "MissingMarkReport", entityId: reportId, metadata: { previousLecturerProfileId: report.assignedLecturerProfileId, newLecturerProfileId: lecturerProfileId } });
		return { reportId, assignedLecturerProfileId: lecturerProfileId, assignment };
	});
}