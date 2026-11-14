import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { AppError } from "../../shared/utils/app-error.js";

export async function applyAuthorizedAttendanceCorrection({ db = prisma, administratorUserId, discrepancyDecisionId, correctedStatus, reason }) {
	return db.$transaction(async (tx) => {
		const administrator = await tx.user.findFirst({
			where: { id: administratorUserId, isActive: true, roles: { some: { role: { name: "administrator" } } } },
			select: { id: true },
		});
		if (!administrator) throw new AppError(403, "An active administrator account is required");

		const decision = await tx.attendanceDiscrepancyDecision.findUnique({
			where: { id: discrepancyDecisionId },
			select: {
				id: true,
				decision: true,
				newStatus: true,
				sourceStatusAtAuthorization: true,
				sourceTypeAtAuthorization: true,
				sourceIdAtAuthorization: true,
				revalidatesDecisionId: true,
				discrepancy: {
					select: {
						id: true,
						studentProfileId: true,
						status: true,
						attendanceRecordId: true,
						assessmentAttendanceId: true,
						attendanceAttemptId: true,
						attendanceRecord: { select: { id: true, studentProfileId: true, status: true } },
					},
				},
			},
		});
		if (!decision) throw new AppError(404, "Attendance correction authorization not found");
		const isFreshRevalidation = decision.decision === "REVALIDATE_LEGACY_AUTHORIZATION";
		if ((!isFreshRevalidation && decision.decision !== "AUTHORIZE_ATTENDANCE_CORRECTION") || decision.newStatus !== "CORRECTION_AUTHORIZED" || decision.discrepancy.status !== "CORRECTION_AUTHORIZED") {
			throw new AppError(409, "Attendance correction is not authorized or the discrepancy is no longer eligible");
		}
		if (isFreshRevalidation) {
			if (!decision.revalidatesDecisionId || decision.sourceTypeAtAuthorization !== "ATTENDANCE_RECORD" || !decision.sourceIdAtAuthorization) {
				throw new AppError(409, "Fresh correction authorization is missing its revalidation provenance");
			}
			const original = await tx.attendanceDiscrepancyDecision.findUnique({
				where: { id: decision.revalidatesDecisionId },
				select: { id: true, discrepancyId: true, decision: true, newStatus: true, sourceStatusAtAuthorization: true },
			});
			if (!original || original.discrepancyId !== decision.discrepancy.id || original.decision !== "AUTHORIZE_ATTENDANCE_CORRECTION" || original.newStatus !== "CORRECTION_AUTHORIZED" || original.sourceStatusAtAuthorization != null) {
				throw new AppError(409, "Fresh authorization does not reference a valid legacy authorization");
			}
		} else if (!decision.sourceStatusAtAuthorization || decision.revalidatesDecisionId) {
			throw new AppError(409, "Legacy attendance correction authorization requires COD revalidation");
		}
		const item = decision.discrepancy;
		const sourceCount = [item.attendanceRecordId, item.assessmentAttendanceId, item.attendanceAttemptId].filter(Boolean).length;
		if (sourceCount !== 1) throw new AppError(409, "Discrepancy must reference exactly one attendance source");
		if (!item.attendanceRecordId || item.assessmentAttendanceId || item.attendanceAttemptId || !item.attendanceRecord) {
			throw new AppError(409, "Admin corrections are supported only for session attendance records");
		}
		if (item.attendanceRecord.studentProfileId !== item.studentProfileId) throw new AppError(409, "Attendance source does not match the discrepancy student");
		if (isFreshRevalidation && (decision.sourceIdAtAuthorization !== item.attendanceRecordId || decision.sourceIdAtAuthorization !== item.attendanceRecord.id)) {
			throw new AppError(409, "Fresh authorization does not match the discrepancy attendance source");
		}
		if (!decision.sourceStatusAtAuthorization || item.attendanceRecord.status !== decision.sourceStatusAtAuthorization) {
			throw new AppError(409, "Attendance record status changed after COD authorization");
		}
		const existing = await tx.attendanceCorrection.findUnique({ where: { discrepancyDecisionId }, select: { id: true } });
		if (existing) throw new AppError(409, "This authorization has already been applied");
		if (item.attendanceRecord.status === correctedStatus) throw new AppError(409, "Corrected status must differ from the current attendance status");

		const recordUpdate = await tx.attendanceRecord.updateMany({
			where: { id: item.attendanceRecordId, status: decision.sourceStatusAtAuthorization },
			data: { status: correctedStatus },
		});
		if (recordUpdate.count !== 1) throw new AppError(409, "Attendance record changed; reload before applying the correction");
		const correction = await tx.attendanceCorrection.create({
			data: {
				attendanceRecordId: item.attendanceRecordId,
				lecturerProfileId: null,
				administratorUserId,
				discrepancyDecisionId,
				originalStatus: decision.sourceStatusAtAuthorization,
				correctedStatus,
				reason: reason.trim(),
			},
			select: { id: true, attendanceRecordId: true, administratorUserId: true, discrepancyDecisionId: true, originalStatus: true, correctedStatus: true, reason: true, createdAt: true },
		});
		const discrepancyUpdate = await tx.attendanceDiscrepancy.updateMany({ where: { id: item.id, status: "CORRECTION_AUTHORIZED" }, data: { status: "CORRECTION_APPLIED" } });
		if (discrepancyUpdate.count !== 1) throw new AppError(409, "Discrepancy state changed; reload before applying the correction");
		await recordAuditEvent({
			prismaClient: tx,
			actorId: administratorUserId,
			action: "ADMIN_ATTENDANCE_CORRECTION_APPLIED",
			entityType: "AttendanceDiscrepancy",
			entityId: item.id,
			metadata: { attendanceCorrectionId: correction.id, decisionId: discrepancyDecisionId, attendanceRecordId: item.attendanceRecordId, originalStatus: correction.originalStatus, correctedStatus },
		});
		return correction;
	});
}
