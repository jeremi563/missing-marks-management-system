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
