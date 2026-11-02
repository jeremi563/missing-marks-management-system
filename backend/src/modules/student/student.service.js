import { generateReference } from "../../shared/utils/generate-reference.js";

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

const FINAL_REPORT_STATUSES = new Set([
	"Approved",
	"Rejected",
	"Resolved",
	"Completed",
	"Closed",
	"Decision Recorded",
	"Finalised",
	"Finalized",
]);

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
		where: { reportId: report.id },
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

	const report = await prisma.missingMarkReport.findFirst({
		where: {
			id: reportId,
			studentProfileId: student.id,
		},
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

	if (!FINAL_REPORT_STATUSES.has(report.status)) {
		const error = new Error("Appeals are only allowed after a final report decision is recorded.");
		error.statusCode = 409;
		throw error;
	}

	const existingAppeal = await prisma.appeal.findFirst({
		where: { reportId: report.id },
		select: { id: true },
	});

	if (existingAppeal) {
		const error = new Error("A report can have at most one appeal submitted.");
		error.statusCode = 409;
		throw error;
	}

	const reason = typeof input.reason === "string" ? input.reason.trim() : "";
	if (!reason) {
		const error = new Error("Appeal reason is required.");
		error.statusCode = 422;
		throw error;
	}

	const comments = typeof input.comments === "string" ? input.comments.trim() : "";

	return prisma.appeal.create({
		data: {
			reportId: report.id,
			studentProfileId: student.id,
			reason,
			status: "Submitted",
			comments: comments || null,
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
		},
	});
}

export async function submitMissingMarkReport(prisma, userId, input) {
	const student = await prisma.studentProfile.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!student) {
		const error = new Error("Student profile not found.");
		error.statusCode = 404;
		throw error;
	}

	const enrollment = await prisma.unitEnrollment.findUnique({
		where: {
			studentProfileId_courseUnitId_academicPeriodId: {
				studentProfileId: student.id,
				courseUnitId: input.courseUnitId,
				academicPeriodId: input.academicPeriodId,
			},
		},
		select: { id: true },
	});

	if (!enrollment) {
		const error = new Error("You are not enrolled in the selected course unit and academic period.");
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
		const report = await transaction.missingMarkReport.create({
			data: {
				reference: generateReference(submittedAt),
				studentProfileId: student.id,
				courseUnitId: input.courseUnitId,
				academicPeriodId: input.academicPeriodId,
				assessmentId: input.assessmentId,
				assessmentComponent: input.assessmentComponent,
				description: input.description,
				status: "Submitted",
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

		await transaction.auditLog.create({
			data: {
				actorId: userId,
				action: "REPORT_SUBMITTED",
				entityType: "MissingMarkReport",
				entityId: report.id,
				metadata: { reference: report.reference },
			},
		});

		return report;
	});
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
				where: { id: input.assessmentId, courseUnitId: input.courseUnitId ?? (await prisma.missingMarkReport.findUnique({ where: { id: reportId }, select: { courseUnitId: true } })).courseUnitId },
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
	if (typeof input.courseUnitId !== "undefined") payload.courseUnitId = input.courseUnitId;

	if (Object.keys(payload).length === 0) {
		return report;
	}

	return prisma.$transaction(async (transaction) => {
		const updated = await transaction.missingMarkReport.update({
			where: { id: reportId },
			data: payload,
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
		const updated = await transaction.missingMarkReport.update({
			where: { id: reportId },
			data: { status: "Withdrawn" },
			select: { id: true, status: true },
		});

		await transaction.reportStatusHistory.create({
			data: {
				reportId: report.id,
				actorUserId: userId,
				previousStatus: report.status,
				newStatus: "Withdrawn",
				reason: "Student withdrew the report before a decision was recorded.",
			},
		});

		return updated;
	});
}
