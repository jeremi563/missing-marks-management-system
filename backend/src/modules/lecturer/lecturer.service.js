
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

//individual missing marks details  :: feature 2

export const getAssignedReportById = async (
  prisma,
  lecturerUserId,
  reportId
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

  const report = await prisma.missingMarkReport.findFirst({
    where: {
      id: reportId,
      assignedLecturerProfileId: lecturer.id,
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
          code: true,
          name: true,
          startsAt: true,
          endsAt: true,
        },
      },

      assessment: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          assessmentDate: true,
          maximumMarks: true,
        },
      },
    },
  });

  if (!report) {
    const error = new Error(
      'Missing-mark report not found.'
    );
    error.statusCode = 404;
    throw error;
  }

  return report;
};
//feature 3:: report investigation and comments
// Feature 3: Report investigation and comments

const getAssignedReportForComments = async (
  prisma,
  lecturerUserId,
  reportId
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

  const report = await prisma.missingMarkReport.findFirst({
    where: {
      id: reportId,
      assignedLecturerProfileId: lecturer.id,
    },
    select: {
      id: true,
    },
  });

  if (!report) {
    const error = new Error('Missing-mark report not found.');
    error.statusCode = 404;
    throw error;
  }

  return report;
};

const commentAuthorSelection = {
  id: true,
  displayName: true,
  roles: {
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
};

export const getReportComments = async (
  prisma,
  lecturerUserId,
  reportId
) => {
  const report = await getAssignedReportForComments(
    prisma,
    lecturerUserId,
    reportId
  );

  const comments = await prisma.reportComment.findMany({
    where: {
      reportId: report.id,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: {
        select: commentAuthorSelection,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return comments.map((comment) => ({
    ...comment,
    author: {
      ...comment.author,
      roles: comment.author.roles.map(
        (userRole) => userRole.role.name
      ),
    },
  }));
};

export const createReportComment = async (
  prisma,
  lecturerUserId,
  reportId,
  body
) => {
  const report = await getAssignedReportForComments(
    prisma,
    lecturerUserId,
    reportId
  );

  const comment = await prisma.reportComment.create({
    data: {
      reportId: report.id,
      authorUserId: lecturerUserId,
      body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: {
        select: commentAuthorSelection,
      },
    },
  });

  return {
    ...comment,
    author: {
      ...comment.author,
      roles: comment.author.roles.map(
        (userRole) => userRole.role.name
      ),
    },
  };
};