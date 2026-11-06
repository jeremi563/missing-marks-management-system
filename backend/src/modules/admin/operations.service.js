import { z } from "zod";
import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { AppError } from "../../shared/utils/app-error.js";

const settingValidators = {
	notification_batch_size: z.number().int().min(1).max(1000),
	notification_poll_interval_ms: z.number().int().min(1000).max(300000),
	max_page_size: z.number().int().min(1).max(100),
};

function validateSetting(key, value) {
	const validator = settingValidators[key];
	if (!validator) throw new AppError(422, "This system setting is not administrator-configurable");
	const result = validator.safeParse(value);
	if (!result.success) throw new AppError(422, "The system setting value is invalid", result.error.issues);
}

function pagination(page, limit, total) {
	return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function listSettings({ db = prisma, page, limit }) {
	const [settings, total] = await Promise.all([
		db.systemSetting.findMany({ orderBy: { key: "asc" }, skip: (page - 1) * limit, take: limit, select: { key: true, value: true, description: true, updatedAt: true, updatedBy: { select: { id: true, displayName: true, email: true } } } }),
		db.systemSetting.count(),
	]);
	return { settings, pagination: pagination(page, limit, total) };
}

export async function updateSetting({ db = prisma, actorUserId, key, value, description }) {
	validateSetting(key, value);
	return db.$transaction(async (tx) => {
		const setting = await tx.systemSetting.upsert({
			where: { key },
			update: { value, ...(description !== undefined ? { description } : {}), updatedByUserId: actorUserId },
			create: { key, value, description, updatedByUserId: actorUserId },
			select: { key: true, value: true, description: true, updatedAt: true },
		});
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_SYSTEM_SETTING_UPDATED", entityType: "SystemSetting", entityId: key, metadata: { key } });
		return setting;
	});
}

function reportWhere({ status, departmentId, courseUnitId, academicPeriodId, from, to }) {
	return {
		...(status ? { status } : {}),
		...(courseUnitId ? { courseUnitId } : {}),
		...(academicPeriodId ? { academicPeriodId } : {}),
		...(departmentId ? { courseUnit: { departmentId } } : {}),
		...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
	};
}

export async function listReportSummaries({ db = prisma, page, limit, status, departmentId, courseUnitId, academicPeriodId, from, to }) {
	const where = reportWhere({ status, departmentId, courseUnitId, academicPeriodId, from, to });
	const [reports, total, byStatus] = await Promise.all([
		db.missingMarkReport.findMany({
			where, orderBy: [{ createdAt: "desc" }, { reference: "asc" }], skip: (page - 1) * limit, take: limit,
			select: {
				id: true, reference: true, status: true, submittedAt: true, createdAt: true, updatedAt: true,
				courseUnit: { select: { id: true, code: true, name: true, department: { select: { id: true, code: true, name: true } } } },
				academicPeriod: { select: { id: true, code: true, name: true } },
				assignedLecturer: { select: { id: true, staffNumber: true, user: { select: { id: true, displayName: true, email: true } } } },
			},
		}),
		db.missingMarkReport.count({ where }),
		db.missingMarkReport.groupBy({ by: ["status"], where, _count: { _all: true }, orderBy: { status: "asc" } }),
	]);
	return { reports, summary: { total, byStatus: byStatus.map(({ status: reportStatus, _count: count }) => ({ status: reportStatus, count: count._all })) }, pagination: pagination(page, limit, total) };
}

export async function listAuditLogs({ db = prisma, page, limit, action, entityType, actorId, from, to }) {
	const where = {
		...(action ? { action } : {}),
		...(entityType ? { entityType } : {}),
		...(actorId ? { actorId } : {}),
		...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
	};
	const [logs, total] = await Promise.all([
		db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true, actor: { select: { id: true, displayName: true, email: true } } } }),
		db.auditLog.count({ where }),
	]);
	return { logs, pagination: pagination(page, limit, total) };
}