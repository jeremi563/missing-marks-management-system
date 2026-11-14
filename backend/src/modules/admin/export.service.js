import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { reportWhere } from "./operations.service.js";

export async function exportReportSummaries({ db = prisma, actorUserId, maxRows, status, departmentId, courseUnitId, academicPeriodId, from, to }) {
	return db.$transaction(async (tx) => {
		const reports = await tx.missingMarkReport.findMany({
			where: reportWhere({ status, departmentId, courseUnitId, academicPeriodId, from, to }),
			orderBy: [{ createdAt: "desc" }, { reference: "asc" }], take: maxRows,
			select: {
				reference: true, status: true, submittedAt: true, createdAt: true, updatedAt: true,
				courseUnit: { select: { code: true, name: true, department: { select: { code: true, name: true } } } },
				academicPeriod: { select: { code: true, name: true } },
				assignedLecturer: { select: { staffNumber: true, user: { select: { displayName: true, email: true } } } },
			},
		});
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_REPORT_EXPORT_REQUESTED", entityType: "MissingMarkReport", metadata: { rowCount: reports.length, maxRows } });
		return reports.map((report) => [
			report.reference, report.status, report.courseUnit.department.code, report.courseUnit.department.name,
			report.courseUnit.code, report.courseUnit.name, report.academicPeriod.code, report.academicPeriod.name,
			report.assignedLecturer?.staffNumber, report.assignedLecturer?.user.displayName, report.assignedLecturer?.user.email,
			report.submittedAt, report.createdAt, report.updatedAt,
		]);
	});
}

export async function exportAuditLogs({ db = prisma, actorUserId, maxRows, action, entityType, actorId, from, to }) {
	return db.$transaction(async (tx) => {
		const logs = await tx.auditLog.findMany({
			where: { ...(action ? { action } : {}), ...(entityType ? { entityType } : {}), ...(actorId ? { actorId } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
			orderBy: { createdAt: "desc" }, take: maxRows,
			select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actor: { select: { displayName: true, email: true } } },
		});
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_AUDIT_EXPORT_REQUESTED", entityType: "AuditLog", metadata: { rowCount: logs.length, maxRows } });
		return logs.map((log) => [log.id, log.action, log.entityType, log.entityId, log.actor?.displayName, log.actor?.email, log.createdAt, log.metadata]);
	});
}