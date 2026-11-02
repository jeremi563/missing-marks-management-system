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
