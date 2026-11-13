import { AppError } from "../../shared/utils/app-error.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { getDesignatedCodDepartmentIds, isActiveCodDepartmentMember } from "../../shared/services/designated-cod-authorization.service.js";

export async function getLecturerDepartmentOptions(db, userId) {
	const lecturerProfile = await db.lecturerProfile.findUnique({
		where: { userId },
		select: {
			unitAssignments: {
				select: { courseUnit: { select: { department: { select: { id: true, name: true, code: true } } } } },
			},
		},
	});
	const assignedDepartments = [...new Map(
		(lecturerProfile?.unitAssignments ?? []).map(({ courseUnit }) => [courseUnit.department.id, courseUnit.department]),
	).values()].sort((first, second) => first.name.localeCompare(second.name));
	return { assignedDepartments };
}

export async function listCodDepartmentMembershipRequests(db, userId) {
	const departmentIds = await getDesignatedCodDepartmentIds(db, userId);
	if (!departmentIds.length) return [];
	return db.departmentMembershipRequest.findMany({
		where: {
			departmentId: { in: departmentIds },
			status: "PENDING",
			lecturer: { isActive: true, approvalStatus: "APPROVED" },
		},
		orderBy: { createdAt: "asc" },
		take: 200,
		select: {
			id: true,
			createdAt: true,
			department: { select: { id: true, name: true, code: true } },
			lecturer: {
				select: {
					id: true,
					displayName: true,
					email: true,
					lecturerProfile: { select: { staffNumber: true } },
				},
			},
		},
	});
}

export async function decideCodDepartmentMembershipRequest(db, codUserId, requestId, status) {
	return db.$transaction(async (tx) => {
		const request = await tx.departmentMembershipRequest.findUnique({
			where: { id: requestId },
			select: {
				id: true,
				lecturerUserId: true,
				departmentId: true,
				status: true,
				lecturer: { select: { isActive: true, approvalStatus: true } },
				department: { select: { name: true, designatedCodUserId: true } },
			},
		});
		if (!request) throw new AppError(404, "Department membership request not found");
		if (!request.lecturer.isActive || request.lecturer.approvalStatus !== "APPROVED") {
			throw new AppError(409, "The primary department must approve the lecturer account before additional memberships can be decided");
		}
		if (request.department.designatedCodUserId !== codUserId
			|| !await isActiveCodDepartmentMember(tx, codUserId, request.departmentId)) {
			throw new AppError(403, "Only the designated COD can decide this department request");
		}
		if (request.status !== "PENDING") throw new AppError(409, "This department request has already been decided");

		if (status === "APPROVED") {
			await tx.departmentMembership.upsert({
				where: { userId_departmentId: { userId: request.lecturerUserId, departmentId: request.departmentId } },
				create: { userId: request.lecturerUserId, departmentId: request.departmentId },
				update: {},
			});
		}
		const updated = await tx.departmentMembershipRequest.updateMany({
			where: { id: request.id, status: "PENDING" },
			data: { status, reviewedByUserId: codUserId, reviewedAt: new Date() },
		});
		if (updated.count !== 1) throw new AppError(409, "This department request has already been decided");
		await recordAuditEvent({
			prismaClient: tx,
			actorId: codUserId,
			action: `COD_LECTURER_DEPARTMENT_REQUEST_${status}`,
			entityType: "DepartmentMembershipRequest",
			entityId: request.id,
			metadata: { lecturerUserId: request.lecturerUserId, departmentId: request.departmentId },
		});
		await tx.notification.create({
			data: {
				userId: request.lecturerUserId,
				title: `Department request ${status === "APPROVED" ? "approved" : "declined"}`,
				message: `Your request to join ${request.department.name} was ${status === "APPROVED" ? "approved" : "declined"}.`,
			},
		});
		return { id: request.id, status, departmentId: request.departmentId };
	});
}
