
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

// Feature 4: Submit a lecturer decision on an assigned report

export const submitReportDecision = async (
  prisma,
  lecturerUserId,
  reportId,
  decision,
  reason
) => {
    if (
    typeof decision !== 'string' ||
    !['APPROVE', 'REJECT'].includes(decision.toUpperCase())
  ) {
    const error = new Error('Invalid lecturer decision.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedDecision = decision.toUpperCase();
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
      status: true,
    },
  });

  if (!report) {
    const error = new Error('Missing-mark report not found.');
    error.statusCode = 404;
    throw error;
  }

    if (
    typeof report.status !== 'string' ||
    report.status.toUpperCase() !== 'PENDING'
  ) {
    const error = new Error(
      'This report has already been decided or is not awaiting a decision.'
    );
    error.statusCode = 409;
    throw error;
  }

  const newStatus =
    normalizedDecision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  return prisma.$transaction(async (transaction) => {
    const updateResult = await transaction.missingMarkReport.updateMany({
      where: {
        id: report.id,
        assignedLecturerProfileId: lecturer.id,
        status: report.status,
      },
      data: {
        status: newStatus,
      },
    });

    if (updateResult.count !== 1) {
      const error = new Error(
        'This report has already been decided or its status has changed.'
      );
      error.statusCode = 409;
      throw error;
    }

    const history = await transaction.reportStatusHistory.create({
      data: {
        reportId: report.id,
        actorUserId: lecturerUserId,
        previousStatus: report.status,
        newStatus,
        reason,
      },
      select: {
        id: true,
        previousStatus: true,
        newStatus: true,
        reason: true,
        createdAt: true,
      },
    });

    return {
      reportId: report.id,
      reference: report.reference,
      decision: normalizedDecision,
      status: newStatus,
      history,
    };
  });
};
