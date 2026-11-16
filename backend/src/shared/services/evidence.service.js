import { AppError } from "../utils/app-error.js";
import { EVIDENCE_MIME_BY_EXTENSION, sanitizeEvidenceFilename } from "../utils/evidence-validation.js";
import { recordAuditEvent } from "./audit.service.js";
import { getDesignatedCodDepartmentIds } from "./designated-cod-authorization.service.js";
import { evidenceStorage } from "./evidence-storage.service.js";

function notFound() {
	return new AppError(404, "Evidence not found");
}

export async function assertEvidenceAccess({ db, userId, roles, evidence }) {
	const report = evidence.report;
	if (!report) throw notFound();
	if (evidence.appealId && (!evidence.appeal || evidence.appeal.reportId !== report.id
		|| evidence.appeal.studentProfileId !== report.studentProfileId)) throw notFound();
	if (evidence.specialCaseId && (!evidence.specialCase || evidence.specialCase.reportId !== report.id)) throw notFound();
	if (evidence.appealId && evidence.specialCaseId) throw notFound();

	if (roles.includes("student")) {
		const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
		const isOwnReport = student?.id === report.studentProfileId;
		const isOwnAppeal = !evidence.appealId || evidence.appeal.studentProfileId === student?.id;
		const isOwnCase = !evidence.specialCaseId || evidence.specialCase.submittedByUserId === userId;
		if (isOwnReport && isOwnAppeal && isOwnCase) return;
	}

	if (roles.includes("lecturer")) {
		const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
		const assignedToReport = lecturer?.id === report.assignedLecturerProfileId;
		const submittedOwnCase = evidence.specialCaseId && evidence.specialCase.submittedByUserId === userId;
		if (!evidence.appealId && (assignedToReport || submittedOwnCase)) return;
	}

	if (roles.includes("cod")) {
		const designatedDepartmentIds = await getDesignatedCodDepartmentIds(db, userId);
		if (designatedDepartmentIds.includes(report.courseUnit.departmentId)) return;
	}

	throw notFound();
}

export async function getEvidenceDownload({
	db,
	userId,
	roles,
	evidenceId,
	storage = evidenceStorage,
}) {
	const evidence = await db.specialCaseEvidence.findUnique({
		where: { id: evidenceId },
		select: {
			id: true,
			reportId: true,
			appealId: true,
			specialCaseId: true,
			originalName: true,
			storageKey: true,
			mediaType: true,
			sizeBytes: true,
			report: {
				select: {
					id: true,
					studentProfileId: true,
					assignedLecturerProfileId: true,
					courseUnit: { select: { departmentId: true } },
				},
			},
			appeal: { select: { reportId: true, studentProfileId: true } },
			specialCase: { select: { reportId: true, submittedByUserId: true } },
		},
	});
	if (!evidence) throw notFound();
	await assertEvidenceAccess({ db, userId, roles, evidence });

	const buffer = await storage.read(evidence.storageKey);
	if (buffer.length !== evidence.sizeBytes) throw new AppError(500, "Evidence file is unavailable");
	const originalName = sanitizeEvidenceFilename(evidence.originalName);
	const extension = originalName.split(".").at(-1);
	if (EVIDENCE_MIME_BY_EXTENSION.get(extension) !== evidence.mediaType) throw notFound();
	await recordAuditEvent({
		prismaClient: db,
		actorId: userId,
		action: "EVIDENCE_DOWNLOADED",
		entityType: "SpecialCaseEvidence",
		entityId: evidence.id,
		metadata: {
			reportId: evidence.reportId,
			appealId: evidence.appealId,
			specialCaseId: evidence.specialCaseId,
		},
	});
	return {
		buffer,
		originalName,
		mediaType: evidence.mediaType,
	};
}
