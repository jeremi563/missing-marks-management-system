import { AppError } from "../utils/app-error.js";
import { EVIDENCE_MIME_BY_EXTENSION, sanitizeEvidenceFilename } from "../utils/evidence-validation.js";
import { recordAuditEvent } from "./audit.service.js";
import { getDesignatedCodDepartmentIds } from "./designated-cod-authorization.service.js";
import { evidenceStorage } from "./evidence-storage.service.js";
import { academicYearForPeriod } from "../utils/academic-year.js";

function notFound() {
	return new AppError(404, "Evidence not found");
}

export async function assertEvidenceAccess({ db, userId, roles, evidence }) {
	const report = evidence.report;
	const specialCase = evidence.specialCase;
	if (evidence.reportId !== (report?.id ?? null)) throw notFound();
	if (!report && !specialCase) throw notFound();
	if (evidence.appealId && (!report || !evidence.appeal || evidence.appeal.reportId !== report.id
		|| evidence.appeal.studentProfileId !== report.studentProfileId)) throw notFound();
	if (evidence.specialCaseId && (!specialCase || specialCase.reportId !== evidence.reportId)) throw notFound();
	if (evidence.appealId && evidence.specialCaseId) throw notFound();

	if (roles.includes("student")) {
		const student = await db.studentProfile.findUnique({ where: { userId }, select: { id: true } });
		const isOwnReport = report ? student?.id === report.studentProfileId : specialCase?.studentProfileId === student?.id;
		const isOwnAppeal = !evidence.appealId || evidence.appeal.studentProfileId === student?.id;
		const isOwnCase = !evidence.specialCaseId || (specialCase.reportId
			? specialCase.submittedByUserId === userId
			: specialCase.studentProfileId === student?.id);
		if (isOwnReport && isOwnAppeal && isOwnCase) return;
	}

	if (roles.includes("lecturer")) {
		const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
		const assignedToReport = Boolean(report && lecturer?.id === report.assignedLecturerProfileId);
		let assignedToStandaloneCase = false;
		if (specialCase && !specialCase.reportId && lecturer && specialCase.courseUnitId && specialCase.academicPeriod) {
			const academicYear = academicYearForPeriod(specialCase.academicPeriod);
			assignedToStandaloneCase = Boolean(academicYear && await db.courseUnitLecturer.findFirst({
				where: { courseUnitId: specialCase.courseUnitId, lecturerProfileId: lecturer.id, academicYear, isActive: true },
				select: { id: true },
			}));
		}
		const submittedOwnCase = evidence.specialCaseId && specialCase.submittedByUserId === userId;
		if (!evidence.appealId && (assignedToReport || assignedToStandaloneCase || submittedOwnCase)) return;
	}

	if (roles.includes("cod")) {
		const designatedDepartmentIds = await getDesignatedCodDepartmentIds(db, userId);
		const departmentId = report?.courseUnit.departmentId ?? specialCase?.courseUnit?.departmentId;
		if (departmentId && designatedDepartmentIds.includes(departmentId)) return;
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
			specialCase: { select: {
				reportId: true,
				submittedByUserId: true,
				studentProfileId: true,
				courseUnitId: true,
				administrativeResolutionRequired: true,
				courseUnit: { select: { departmentId: true } },
				academicPeriod: { select: { startsAt: true } },
			} },
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
