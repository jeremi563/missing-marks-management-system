
export const getAssignedReports = async (
  prisma,
  lecturerUserId,
  filters = {}
) => {
  const lecturer = await prisma.lecturerProfile.findUnique({
    where: {
      userId: lecturerUserId,
    },
    select: {
      id: true,
    },
  });

  if (!lecturer) {
    const error = new Error('Lecturer profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(filters.limit, 10) || 10)
  );

  const skip = (page - 1) * limit;

  const where = {
    assignedLecturerProfileId: lecturer.id,
  };

  if (filters.status) {
    where.status = filters.status;
  }

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

        student: {
          select: {
            id: true,
            studentNumber: true,
          },
        },

        courseUnit: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },

        academicPeriod: {
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
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
};
