
import { createHash, randomBytes } from 'node:crypto';
import { recordAuditEvent } from '../../shared/services/audit.service.js';
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

export const escalateAssignedReport = async (prisma, lecturerUserId, reportId, reason) => {
  const lecturer = await prisma.lecturerProfile.findUnique({
    where: { userId: lecturerUserId },
    select: { id: true },
  });
  if (!lecturer) {
    const error = new Error('Lecturer profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const report = await prisma.missingMarkReport.findFirst({
    where: { id: reportId, assignedLecturerProfileId: lecturer.id },
    select: { id: true, reference: true, status: true },
  });
  if (!report) {
    const error = new Error('Missing-mark report not found.');
    error.statusCode = 404;
    throw error;
  }

  const originalDecision = typeof report.status === 'string' ? report.status.toUpperCase() : '';
  if (!['APPROVED', 'REJECTED'].includes(originalDecision)) {
    const error = new Error('Only an approved or rejected lecturer decision can be escalated.');
    error.statusCode = 409;
    throw error;
  }

  const priorEscalation = await prisma.reportStatusHistory.findFirst({
    where: { reportId: report.id, newStatus: 'ESCALATED' },
    select: { id: true },
  });
  if (priorEscalation) {
    const error = new Error('This report has already been escalated.');
    error.statusCode = 409;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.missingMarkReport.updateMany({
      where: {
        id: report.id,
        assignedLecturerProfileId: lecturer.id,
        status: report.status,
      },
      data: { status: 'ESCALATED' },
    });
    if (updated.count !== 1) {
      const error = new Error('This report has already been escalated or its status has changed.');
      error.statusCode = 409;
      throw error;
    }

    const history = await tx.reportStatusHistory.create({
      data: {
        reportId: report.id,
        actorUserId: lecturerUserId,
        previousStatus: report.status,
        newStatus: 'ESCALATED',
        reason,
      },
      select: { id: true, previousStatus: true, newStatus: true, reason: true, createdAt: true },
    });
    await recordAuditEvent({
      prismaClient: tx,
      actorId: lecturerUserId,
      action: 'REPORT_ESCALATED',
      entityType: 'MissingMarkReport',
      entityId: report.id,
      metadata: { previousStatus: report.status, newStatus: 'ESCALATED' },
    });

    return {
      reportId: report.id,
      reference: report.reference,
      lecturerDecision: originalDecision,
      status: 'ESCALATED',
      history,
    };
  });
};

// Feature 5: Mark-correction proposal submission

export const submitMarkCorrection = async (
  prisma,
  lecturerUserId,
  reportId,
  proposedValue,
  reason
) => {
  if (
    typeof proposedValue !== 'number' ||
    !Number.isFinite(proposedValue) ||
    proposedValue < 0
  ) {
    const error = new Error('Invalid proposed mark.');
    error.statusCode = 400;
    throw error;
  }

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
      assessment: {
        select: {
          maximumMarks: true,
        },
      },
    },
  });

  if (!report) {
    const error = new Error('Missing-mark report not found.');
    error.statusCode = 404;
    throw error;
  }

  if (
    typeof report.status !== 'string' ||
    report.status.toUpperCase() !== 'APPROVED'
  ) {
    const error = new Error(
      'Mark corrections can only be proposed for approved reports.'
    );
    error.statusCode = 409;
    throw error;
  }

  const maximumMarks = report.assessment?.maximumMarks;

  if (maximumMarks === null || maximumMarks === undefined) {
    const error = new Error(
      'The assessment maximum mark is unavailable.'
    );
    error.statusCode = 422;
    throw error;
  }

  if (proposedValue > Number(maximumMarks)) {
    const error = new Error(
      'Proposed mark cannot exceed the assessment maximum.'
    );
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (transaction) => {
    const existingCorrection =
      await transaction.markCorrection.findFirst({
        where: {
          reportId: report.id,
          status: 'PENDING_REVIEW',
        },
        select: {
          id: true,
        },
      });

    if (existingCorrection) {
      const error = new Error(
        'An outstanding correction proposal already exists for this report.'
      );
      error.statusCode = 409;
      throw error;
    }

    const correction = await transaction.markCorrection.create({
      data: {
        reportId: report.id,
        proposedByLecturerId: lecturer.id,
        originalValue: null,
        proposedValue,
        status: 'PENDING_REVIEW',
        reason,
      },
      select: {
        id: true,
        reportId: true,
        proposedByLecturerId: true,
        originalValue: true,
        proposedValue: true,
        status: true,
        reason: true,
        createdAt: true,
      },
    });

    return {
      reportId: report.id,
      reference: report.reference,
      correction,
    };
  });
};


// Feature 6: Create a unified attendance session

export const createAttendanceSession = async (
  prisma,
  lecturerUserId,
  sessionData
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

  // Verify that the lecturer is assigned to the selected course unit.
  const assignment = await prisma.courseUnitLecturer.findUnique({
    where: {
      courseUnitId_lecturerProfileId: {
        courseUnitId: sessionData.courseUnitId,
        lecturerProfileId: lecturer.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    const error = new Error(
      'You are not assigned to this course unit.'
    );
    error.statusCode = 403;
    throw error;
  }

  // Verify that the selected classroom exists and is active.
  const classroom = await prisma.classroom.findFirst({
    where: {
      id: sessionData.classroomId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!classroom) {
    const error = new Error('Active classroom not found.');
    error.statusCode = 404;
    throw error;
  }

  // Validate assessment requirements for CAT and EXAM sessions.
  let assessmentId = null;

  if (sessionData.sessionType === 'CLASS') {
    if (sessionData.assessmentId) {
      const error = new Error(
        'CLASS sessions must not reference an assessment.'
      );
      error.statusCode = 400;
      throw error;
    }
  } else if (
    sessionData.sessionType === 'CAT' ||
    sessionData.sessionType === 'EXAM'
  ) {
    if (!sessionData.assessmentId) {
      const error = new Error(
        'CAT and EXAM sessions require an assessment.'
      );
      error.statusCode = 400;
      throw error;
    }

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: sessionData.assessmentId,
        courseUnitId: sessionData.courseUnitId,
        type: sessionData.sessionType,
      },
      select: {
        id: true,
      },
    });

    if (!assessment) {
      const error = new Error(
        'The assessment must exist, belong to the selected course unit, and match the session type.'
      );
      error.statusCode = 422;
      throw error;
    }

    assessmentId = assessment.id;
  } else {
    const error = new Error('Invalid attendance session type.');
    error.statusCode = 400;
    throw error;
  }

  // Generate a secure QR token and store only its SHA-256 hash.
  const qrToken = randomBytes(32).toString('hex');

  const accessTokenHash = createHash('sha256')
    .update(qrToken)
    .digest('hex');

  const session = await prisma.attendanceSession.create({
    data: {
      courseUnitId: sessionData.courseUnitId,
      lecturerProfileId: lecturer.id,
      classroomId: classroom.id,
      assessmentId,
      sessionType: sessionData.sessionType,
      accessTokenHash,
      status: 'scheduled',
      startsAt: new Date(sessionData.startsAt),
      endsAt: sessionData.endsAt
        ? new Date(sessionData.endsAt)
        : null,
    },
    select: {
      id: true,
      courseUnitId: true,
      lecturerProfileId: true,
      classroomId: true,
      assessmentId: true,
      sessionType: true,
      status: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      courseUnit: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      classroom: {
        select: {
          id: true,
          name: true,
        },
      },
      assessment: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return {
    session,
    qrToken,
  };
};

// Feature 6: Retrieve attendance sessions assigned to the lecturer

export const getAttendanceSessions = async (
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
    lecturerProfileId: lecturer.id,
  };

  if (filters.courseUnitId) {
    where.courseUnitId = filters.courseUnitId;
  }

  if (filters.sessionType) {
    where.sessionType = filters.sessionType;
}

  if (filters.status) {
    where.status = filters.status;
  }

  const [sessions, total] = await prisma.$transaction([
    prisma.attendanceSession.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        courseUnitId: true,
        lecturerProfileId: true,
        classroomId: true,
        sessionType: true,
        assessmentId: true,
        status: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,

        courseUnit: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },

        classroom: {
          select: {
            id: true,
            name: true,
          },
        },

        assessment: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },

        _count: {
          select: {
            records: true,
          },
        },
      },
      orderBy: {
        startsAt: 'desc',
      },
    }),

    prisma.attendanceSession.count({ where }),
  ]);

  return {
    sessions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
// Feature 6: Retrieve an individual attendance session
export const getAttendanceSessionById = async (
  prisma,
  lecturerUserId,
  sessionId
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

  const session = await prisma.attendanceSession.findFirst({
    where: {
      id: sessionId,
      lecturerProfileId: lecturer.id,
    },
    select: {
      id: true,
      courseUnitId: true,
      lecturerProfileId: true,
      classroomId: true,
      sessionType: true,
      assessmentId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      updatedAt: true,

      courseUnit: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      classroom: {
        select: {
          id: true,
          name: true,
        },
      },

      assessment: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      },

      _count: {
        select: {
          records: true,
        },
      },
    },
  });

  if (!session) {
    const error = new Error('Attendance session not found.');
    error.statusCode = 404;
    throw error;
  }

  return session;
};
