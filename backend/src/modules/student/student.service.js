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
