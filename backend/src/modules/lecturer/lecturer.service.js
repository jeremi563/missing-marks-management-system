
import { createHash, randomBytes } from 'node:crypto';
import { recordAuditEvent } from '../../shared/services/audit.service.js';
import { AppError } from '../../shared/utils/app-error.js';
import { loadAttendanceDiscrepancySource } from '../../shared/services/attendance-discrepancy-source.service.js';
import { createNotification } from '../../shared/services/notification.service.js';
import { enqueueNotificationOnce } from '../../shared/services/notification-outbox.service.js';
import { isActiveCodDepartmentMember } from '../../shared/services/designated-cod-authorization.service.js';
import { academicYearBounds, academicYearForDate, academicYearForPeriod } from '../../shared/utils/academic-year.js';
import { getReportAttendanceReview, isAttendedStatus } from '../../shared/services/report-attendance-eligibility.service.js';

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
        assessmentTypeOtherDescription: true,
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
        assessmentType: { select: { id: true, code: true, name: true } },
        assignments: { where: { newLecturerProfileId: lecturer.id }, orderBy: { createdAt: 'desc' }, take: 1, select: { workStartedAt: true, deadlineAt: true } },
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
      studentProfileId: true,
      courseUnitId: true,
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

      assessmentType: { select: { id: true, code: true, name: true } },
      assignments: { where: { newLecturerProfileId: lecturer.id }, orderBy: { createdAt: 'desc' }, take: 1, select: { workStartedAt: true, deadlineAt: true } },

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

  const attendanceReview = await getReportAttendanceReview(prisma, report);
  return { ...report, attendanceReview };
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
      reference: true,
      student: { select: { userId: true } },
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
  return prisma.$transaction(async (transaction) => {
    const report = await getAssignedReportForComments(
      transaction,
      lecturerUserId,
      reportId
    );

    const comment = await transaction.reportComment.create({
      data: {
        reportId: report.id,
        authorUserId: lecturerUserId,
        body,
        isStudentVisible: true,
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

    await createNotification({
      prismaClient: transaction,
      userId: report.student.userId,
      reportId: report.id,
      title: 'Lecturer feedback on your report',
      message: `Your lecturer shared feedback on report ${report.reference}.`,
      dedupeKey: `REPORT_FEEDBACK:${comment.id}`,
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
  });
};

// Feature 4: Submit a lecturer decision on an assigned report

export const submitReportDecision = async (
  prisma,
  lecturerUserId,
  reportId,
  decision,
  reason,
  assessmentType = {}
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

  const type = await prisma.assessmentType.findFirst({ where: { id: assessmentType.assessmentTypeId, isActive: true }, select: { id: true, code: true, name: true } });
  if (!type) {
    const error = new Error('An active assessment type is required.');
    error.statusCode = 422;
    throw error;
  }
  const otherDescription = typeof assessmentType.assessmentTypeOtherDescription === 'string'
    ? assessmentType.assessmentTypeOtherDescription.trim()
    : '';
  if (type.code === 'OTHER' && !otherDescription) {
    const error = new Error('An explanation is required when assessment type is Other.');
    error.statusCode = 422;
    throw error;
  }
  if (type.code !== 'OTHER' && otherDescription) {
    const error = new Error('An Other explanation is allowed only for the Other assessment type.');
    error.statusCode = 422;
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
    const currentAssignment = await transaction.reportAssignment.findFirst({
      where: { reportId: report.id, newLecturerProfileId: lecturer.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, workStartedAt: true },
    });
    if (!currentAssignment?.workStartedAt) {
      const error = new Error('Start Working must be recorded before submitting a decision.');
      error.statusCode = 409;
      throw error;
    }
    const updateResult = await transaction.missingMarkReport.updateMany({
      where: {
        id: report.id,
        assignedLecturerProfileId: lecturer.id,
        status: report.status,
      },
      data: {
        status: newStatus,
        assessmentTypeId: type.id,
        assessmentTypeOtherDescription: type.code === 'OTHER' ? otherDescription : null,
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

    await recordAuditEvent({
      prismaClient: transaction,
      actorId: lecturerUserId,
      action: 'LECTURER_REPORT_DECISION_RECORDED',
      entityType: 'MissingMarkReport',
      entityId: report.id,
      metadata: { decision: normalizedDecision, status: newStatus, assessmentTypeId: type.id },
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
    select: {
      id: true,
      reference: true,
      status: true,
      courseUnit: {
        select: {
          code: true,
          department: { select: { id: true, designatedCodUserId: true } },
        },
      },
    },
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
    const codUserId = report.courseUnit.department.designatedCodUserId;
    if (await isActiveCodDepartmentMember(tx, codUserId, report.courseUnit.department.id)) {
      await tx.notification.create({
        data: {
          userId: codUserId,
          reportId: report.id,
          title: 'Missing-mark report escalated',
          message: `Report ${report.reference} for ${report.courseUnit.code} requires your review.`,
          dedupeKey: `REPORT_ESCALATED:${report.id}:${codUserId}`,
        },
      });
    }

    return {
      reportId: report.id,
      reference: report.reference,
      lecturerDecision: originalDecision,
      status: 'ESCALATED',
      history,
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
  const assignment = await prisma.courseUnitLecturer.findFirst({
    where: {
      courseUnitId: sessionData.courseUnitId,
      lecturerProfileId: lecturer.id,
      academicYear: academicYearForDate(sessionData.startsAt),
      isActive: true,
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
        type: { equals: sessionData.sessionType, mode: 'insensitive' },
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
      lateGraceMinutes: sessionData.lateGraceMinutes ?? 10,
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
      lateGraceMinutes: true,
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
        lateGraceMinutes: true,
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
      lateGraceMinutes: true,
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

// Feature 6: Start an attendance session
export const startAttendanceSession = async (
  prisma,
  lecturerUserId,
  sessionId
) => {
  const lecturer = await prisma.lecturerProfile.findUnique({
    where: { userId: lecturerUserId },
    select: { id: true },
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
  });

  if (!session) {
    const error = new Error('Attendance session not found.');
    error.statusCode = 404;
    throw error;
  }

  if (session.status !== 'scheduled') {
    const error = new Error(
      'Only scheduled sessions can be started.'
    );
    error.statusCode = 409;
    throw error;
  }

  if (session.endsAt && new Date(session.endsAt) <= new Date()) {
    const error = new Error('This attendance session has passed its scheduled end time and cannot be started.');
    error.statusCode = 409;
    throw error;
  }

  const result = await prisma.attendanceSession.updateMany({
  where: {
    id: sessionId,
    lecturerProfileId: lecturer.id,
    status: 'scheduled',
  },
  data: {
    status: 'active',
  },
});

if (result.count === 0) {
  const error = new Error(
    'Session state changed. Only scheduled sessions can be started.'
  );
  error.statusCode = 409;
  throw error;
}

return prisma.attendanceSession.findUnique({
  where: { id: sessionId },
});
};

export const generateAttendanceLink = async (
  prisma,
  lecturerUserId,
  sessionId
) => {
  const lecturer = await prisma.lecturerProfile.findUnique({
    where: { userId: lecturerUserId },
    select: { id: true },
  });

  if (!lecturer) {
    const error = new Error('Lecturer profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, lecturerProfileId: lecturer.id },
    select: { id: true, status: true, endsAt: true },
  });

  if (!session) {
    const error = new Error('Attendance session not found.');
    error.statusCode = 404;
    throw error;
  }

  if (session.status !== 'active') {
    const error = new Error('Attendance links can only be generated for active sessions.');
    error.statusCode = 409;
    throw error;
  }
  if (session.endsAt && new Date(session.endsAt) <= new Date()) {
    const error = new Error('Attendance links can only be generated before the session end time.');
    error.statusCode = 409;
    throw error;
  }

  const qrToken = randomBytes(32).toString('hex');
  const accessTokenHash = createHash('sha256').update(qrToken).digest('hex');
  const result = await prisma.attendanceSession.updateMany({
    where: { id: sessionId, lecturerProfileId: lecturer.id, status: 'active' },
    data: { accessTokenHash },
  });

  if (result.count === 0) {
    const error = new Error('Session state changed. Generate a link only for an active session.');
    error.statusCode = 409;
    throw error;
  }

  return { sessionId, qrToken };
};

export const extendAttendanceSession = async (
  prisma,
  lecturerUserId,
  sessionId,
  endsAt,
  now = new Date()
) => {
  const lecturer = await prisma.lecturerProfile.findUnique({
    where: { userId: lecturerUserId },
    select: { id: true },
  });
  if (!lecturer) {
    const error = new Error('Lecturer profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, lecturerProfileId: lecturer.id },
    select: { id: true, status: true, endsAt: true },
  });
  if (!session) {
    const error = new Error('Attendance session not found.');
    error.statusCode = 404;
    throw error;
  }
  if (session.status !== 'active') {
    const error = new Error('Only active attendance sessions can be extended.');
    error.statusCode = 409;
    throw error;
  }
  if (session.endsAt && new Date(session.endsAt) <= now) {
    const error = new Error('An expired attendance session cannot be extended.');
    error.statusCode = 409;
    throw error;
  }

  const nextEndTime = new Date(endsAt);
  if (Number.isNaN(nextEndTime.valueOf()) || nextEndTime <= now) {
    const error = new Error('The extended end time must be in the future.');
    error.statusCode = 400;
    throw error;
  }
  if (session.endsAt && nextEndTime <= new Date(session.endsAt)) {
    const error = new Error('The extended end time must be later than the current end time.');
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.attendanceSession.updateMany({
    where: {
      id: sessionId,
      lecturerProfileId: lecturer.id,
      status: 'active',
      endsAt: session.endsAt,
    },
    data: { endsAt: nextEndTime },
  });
  if (result.count === 0) {
    const error = new Error('Session state changed. Refresh the session and try again.');
    error.statusCode = 409;
    throw error;
  }

  return prisma.attendanceSession.findUnique({ where: { id: sessionId } });
};

async function markUnrecordedStudentsAbsent(tx, sessionId, recordedAt) {
  const session = await tx.attendanceSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      courseUnitId: true,
      startsAt: true,
      courseUnit: { select: { code: true, name: true } },
    },
  });
  if (!session?.courseUnit) throw new AppError(500, 'Unable to load attendance session details for absence marking.');

  const academicYear = academicYearForDate(session.startsAt);
  const bounds = academicYearBounds(academicYear);
  if (!bounds) throw new AppError(500, 'Unable to determine the academic year for this attendance session.');

  const enrollments = await tx.unitEnrollment.findMany({
    where: {
      courseUnitId: session.courseUnitId,
      academicPeriod: {
        OR: [
          { academicYear },
          {
            academicYear: null,
            startsAt: { gte: bounds.startsAt, lt: bounds.endsAt },
          },
        ],
      },
    },
    select: { studentProfileId: true },
  });
  const studentProfileIds = [...new Set(enrollments.map(({ studentProfileId }) => studentProfileId))];
  if (studentProfileIds.length === 0) return 0;

  const existingRecords = await tx.attendanceRecord.findMany({
    where: { sessionId, studentProfileId: { in: studentProfileIds } },
    select: { studentProfileId: true },
  });
  const recordedStudentIds = new Set(existingRecords.map(({ studentProfileId }) => studentProfileId));
  const absentStudentIds = studentProfileIds.filter((studentProfileId) => !recordedStudentIds.has(studentProfileId));

  if (absentStudentIds.length > 0) {
    await tx.attendanceRecord.createMany({
      data: absentStudentIds.map((studentProfileId) => ({
        sessionId,
        studentProfileId,
        status: 'ABSENT',
        locationVerified: false,
        recordedAt,
      })),
      skipDuplicates: true,
    });
  }

  const absentRecords = await tx.attendanceRecord.findMany({
    where: { sessionId, studentProfileId: { in: studentProfileIds }, status: 'ABSENT' },
    select: { id: true, studentProfileId: true, locationVerified: true },
  });
  if (absentRecords.length > 0) {
    await tx.attendanceHistory.createMany({
      data: absentRecords.map((record) => ({
        attendanceRecordId: record.id,
        studentProfileId: record.studentProfileId,
        courseUnitCode: session.courseUnit.code,
        courseUnitName: session.courseUnit.name,
        sessionStartedAt: session.startsAt,
        status: 'ABSENT',
        locationVerified: record.locationVerified,
        signedAt: recordedAt,
      })),
      skipDuplicates: true,
    });
  }
  return absentStudentIds.length;
}

export const completeExpiredAttendanceSessions = async (prisma, now = new Date()) => {
  const expiredSessions = await prisma.attendanceSession.findMany({
    where: {
      status: { in: ['scheduled', 'active'] },
      endsAt: { lte: now },
    },
    select: { id: true, status: true, endsAt: true },
  });

  let completedCount = 0;
  for (const session of expiredSessions) {
    const completed = await prisma.$transaction(async (tx) => {
      const result = await tx.attendanceSession.updateMany({
        where: { id: session.id, status: session.status, endsAt: session.endsAt },
        data: { status: 'completed', accessTokenHash: null },
      });
      if (result.count !== 1) return false;
      if (session.status === 'active') {
        await markUnrecordedStudentsAbsent(tx, session.id, now);
      }
      return true;
    });
    if (completed) completedCount += 1;
  }
  return completedCount;
};

// Feature 6: End an attendance session
export const endAttendanceSession = async (
prisma,
lecturerUserId,
  sessionId
) => {
  const lecturer = await prisma.lecturerProfile.findUnique({
    where: { userId: lecturerUserId },
    select: { id: true },
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
  });

  if (!session) {
    const error = new Error('Attendance session not found.');
    error.statusCode = 404;
    throw error;
  }

  if (session.status !== 'active') {
    const error = new Error(
      'Only active sessions can be ended.'
    );
    error.statusCode = 409;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const result = await tx.attendanceSession.updateMany({
      where: {
        id: sessionId,
        lecturerProfileId: lecturer.id,
        status: 'active',
      },
      data: {
        status: 'completed',
        accessTokenHash: null,
      },
    });

    if (result.count === 0) {
      const error = new Error(
        'Session state changed. Only active sessions can be ended.'
      );
      error.statusCode = 409;
      throw error;
    }

    await markUnrecordedStudentsAbsent(tx, sessionId, new Date());
    return tx.attendanceSession.findUnique({
      where: { id: sessionId },
    });
  });
};

// Feature 6: Retrieve attendance records
export const getAttendanceSessionRecords = async (
  prisma,
  lecturerUserId,
  sessionId
) => {
  const lecturer = await prisma.lecturerProfile.findUnique({
    where: { userId: lecturerUserId },
    select: { id: true },
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
      startsAt: true,
    },
  });

  if (!session) {
    const error = new Error('Attendance session not found.');
    error.statusCode = 404;
    throw error;
  }

  const academicYear = academicYearForDate(session.startsAt);
  const academicYearRange = academicYearBounds(academicYear);
  if (!academicYearRange) {
    throw new AppError(500, 'Unable to determine the academic year for this attendance session.');
  }

  const [enrollments, records] = await Promise.all([
    prisma.unitEnrollment.findMany({
      where: {
        courseUnitId: session.courseUnitId,
        academicPeriod: {
          OR: [
            { academicYear },
            {
              academicYear: null,
              startsAt: {
                gte: academicYearRange.startsAt,
                lt: academicYearRange.endsAt,
              },
            },
          ],
        },
      },
      select: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { displayName: true } },
          },
        },
        academicPeriod: {
          select: {
            id: true,
            name: true,
            code: true,
            startsAt: true,
            academicYear: true,
            semester: true,
          },
        },
      },
    }),
    prisma.attendanceRecord.findMany({
    where: { sessionId },
    select: {
      id: true,
      studentProfileId: true,
      status: true,
      locationVerified: true,
      recordedAt: true,
    },
    orderBy: { recordedAt: 'desc' },
    }),
  ]);

  const studentRoster = new Map();
  for (const enrollment of enrollments) {
    const student = enrollment.student;
    if (!student) continue;

    let rosterEntry = studentRoster.get(student.id);
    if (!rosterEntry) {
      rosterEntry = { student, academicPeriods: [] };
      studentRoster.set(student.id, rosterEntry);
    }

    const period = enrollment.academicPeriod;
    if (period && !rosterEntry.academicPeriods.some(({ id }) => id === period.id)) {
      rosterEntry.academicPeriods.push({
        ...period,
        academicYear: academicYearForPeriod(period),
      });
    }
  }

  const recordsByStudent = new Map(
    records.map((record) => [record.studentProfileId, record]),
  );

  return [...studentRoster.values()]
    .map(({ student, academicPeriods }) => {
      const record = recordsByStudent.get(student.id) ?? null;
      return {
        id: record?.id ?? null,
        student,
        academicPeriods: academicPeriods.sort((left, right) => (
          new Date(left.startsAt).valueOf() - new Date(right.startsAt).valueOf()
        )),
        status: record?.status ?? 'ABSENT',
        attended: isAttendedStatus(record?.status),
        locationVerified: record?.locationVerified ?? null,
        recordedAt: record?.recordedAt ?? null,
      };
    })
    .sort((left, right) => (
      left.student.studentNumber.localeCompare(right.student.studentNumber)
      || left.student.id.localeCompare(right.student.id)
    ));
};

async function getDiscrepancyLecturer(db, userId) {
	const lecturer = await db.lecturerProfile.findUnique({ where: { userId }, select: { id: true } });
	if (!lecturer) throw new AppError(404, "Lecturer profile not found");
	return lecturer;
}

export async function createLecturerAttendanceDiscrepancy(db, userId, input) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	const context = await loadAttendanceDiscrepancySource(db, input);
	if (context.assignedLecturerProfileId !== lecturer.id) throw new AppError(404, "Attendance source not found");
	const assignment = await db.courseUnitLecturer.findFirst({ where: { courseUnitId: context.courseUnitId, lecturerProfileId: lecturer.id, academicYear: context.academicYear, isActive: true }, select: { id: true } });
	if (!assignment) throw new AppError(404, "Attendance source not found");
	try {
	return await db.$transaction(async (tx) => {
		const discrepancy = await tx.attendanceDiscrepancy.create({
			data: {
				studentProfileId: context.source.studentProfileId,
				attendanceRecordId: input.attendanceRecordId ?? null,
				assessmentAttendanceId: input.assessmentAttendanceId ?? null,
				attendanceAttemptId: input.attendanceAttemptId ?? null,
				assignedLecturerProfileId: lecturer.id,
				description: input.description.trim(),
				status: "PENDING_COD_REVIEW",
				submittedByUserId: userId,
				submitterType: "LECTURER",
			},
			select: { id: true, status: true, description: true, createdAt: true },
		});
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "LECTURER_ATTENDANCE_DISCREPANCY_SUBMITTED", entityType: "AttendanceDiscrepancy", entityId: discrepancy.id, metadata: { sourceType: context.sourceType } });
		return discrepancy;
	});
	} catch (error) {
		const target = (Array.isArray(error?.meta?.target) ? error.meta.target.join(" ") : String(error?.meta?.target ?? "")).toLowerCase();
		const hasStudent = target.includes("student_profile_id") || target.includes("studentprofileid");
		const hasSource = ["attendance_record_id", "assessment_attendance_id", "attendance_attempt_id", "attendancerecordid", "assessmentattendanceid", "attendanceattemptid"].some((field) => target.includes(field));
		if (error?.code === "P2002" && (target.includes("attendance_discrepancies_active_") || (hasStudent && hasSource))) {
			throw new AppError(409, "An active attendance discrepancy already exists for this student and source");
		}
		throw error;
	}
}

export async function listLecturerAttendanceDiscrepancies(db, userId, { page = 1, limit = 20 } = {}) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	const where = { OR: [
		{ assignedLecturerProfileId: lecturer.id, status: "PENDING_LECTURER_REVIEW" },
		{ submittedByUserId: userId, submitterType: "LECTURER", status: "CLARIFICATION_REQUESTED" },
	] };
	const [items, total] = await db.$transaction([
		db.attendanceDiscrepancy.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit, select: { id: true, studentProfileId: true, attendanceRecordId: true, assessmentAttendanceId: true, attendanceAttemptId: true, assignedLecturerProfileId: true, description: true, status: true, submitterType: true, createdAt: true } }),
		db.attendanceDiscrepancy.count({ where }),
	]);
	return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getLecturerAttendanceDiscrepancy(db, userId, discrepancyId) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	const item = await db.attendanceDiscrepancy.findFirst({
		where: {
			id: discrepancyId,
			OR: [
				{ assignedLecturerProfileId: lecturer.id, status: "PENDING_LECTURER_REVIEW" },
				{ submittedByUserId: userId, submitterType: "LECTURER", assignedLecturerProfileId: lecturer.id, status: "CLARIFICATION_REQUESTED" },
			],
		},
		select: {
			id: true, studentProfileId: true, attendanceRecordId: true, assessmentAttendanceId: true, attendanceAttemptId: true,
			description: true, status: true, createdAt: true,
			attendanceRecord: { select: { id: true, status: true, locationVerified: true, recordedAt: true, session: { select: { id: true, startsAt: true, courseUnit: { select: { id: true, code: true, name: true } } } } } },
			assessmentRecord: { select: { id: true, status: true, recordedAt: true, assessment: { select: { id: true, code: true, name: true, assessmentDate: true, courseUnit: { select: { id: true, code: true, name: true } } } } } },
			attendanceAttempt: { select: { id: true, outcome: true, failureReason: true, occurredAt: true, session: { select: { id: true, startsAt: true, courseUnit: { select: { id: true, code: true, name: true } } } } } },
		},
	});
	if (!item) throw new AppError(404, "Attendance discrepancy not found");
	return item;
}

export async function reviewStudentAttendanceDiscrepancy(db, userId, discrepancyId, { decision, explanation }) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	return db.$transaction(async (tx) => {
		const item = await tx.attendanceDiscrepancy.findUnique({ where: { id: discrepancyId }, select: { id: true, studentProfileId: true, attendanceRecordId: true, assessmentAttendanceId: true, attendanceAttemptId: true, assignedLecturerProfileId: true, submitterType: true, status: true } });
		if (!item || item.assignedLecturerProfileId !== lecturer.id || item.submitterType !== "STUDENT") throw new AppError(404, "Attendance discrepancy not found");
		if (item.status !== "PENDING_LECTURER_REVIEW") throw new AppError(409, "This discrepancy is no longer awaiting lecturer review");
		const context = await loadAttendanceDiscrepancySource(tx, { ...item, studentProfileId: item.studentProfileId });
		if (context.assignedLecturerProfileId !== lecturer.id) throw new AppError(404, "Attendance discrepancy not found");
		const forward = decision === "FORWARD_TO_COD";
		const newStatus = forward ? "PENDING_COD_REVIEW" : "LECTURER_REJECTED";
		const now = new Date();
		const updated = await tx.attendanceDiscrepancy.updateMany({ where: { id: item.id, status: item.status, assignedLecturerProfileId: lecturer.id }, data: { status: newStatus, lecturerReviewedByProfileId: lecturer.id, lecturerReviewedAt: now, resolution: forward ? null : explanation.trim() } });
		if (updated.count !== 1) throw new AppError(409, "Discrepancy state changed; reload before reviewing");
		const decisionRecord = await tx.attendanceDiscrepancyDecision.create({ data: { discrepancyId: item.id, actorUserId: userId, decision: forward ? "LECTURER_FORWARD" : "LECTURER_REJECT", explanation: explanation.trim(), previousStatus: item.status, newStatus } });
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: `LECTURER_ATTENDANCE_DISCREPANCY_${decision}`, entityType: "AttendanceDiscrepancy", entityId: item.id, metadata: { decisionId: decisionRecord.id, previousStatus: item.status, newStatus } });
		return { discrepancyId: item.id, status: newStatus, decision: decisionRecord };
	});
}

export async function respondToLecturerAttendanceDiscrepancy(db, userId, discrepancyId, body) {
	try {
	return await db.$transaction(async (tx) => {
		const lecturer = await getDiscrepancyLecturer(tx, userId);
		const item = await tx.attendanceDiscrepancy.findFirst({ where: { id: discrepancyId, submittedByUserId: userId, submitterType: "LECTURER", assignedLecturerProfileId: lecturer.id }, select: { id: true, status: true } });
		if (!item) throw new AppError(404, "Attendance discrepancy not found");
		if (item.status !== "CLARIFICATION_REQUESTED") throw new AppError(409, "This discrepancy is not awaiting clarification");
		const request = await tx.attendanceDiscrepancyDecision.findFirst({ where: { discrepancyId: item.id, decision: "REQUEST_CLARIFICATION" }, orderBy: { createdAt: "desc" }, select: { id: true } });
		if (!request) throw new AppError(409, "No clarification request is available to answer");
		const previousResponse = await tx.attendanceDiscrepancyComment.findFirst({ where: { discrepancyId: item.id, clarificationDecisionId: request.id, authorUserId: userId }, select: { id: true } });
		if (previousResponse) throw new AppError(409, "The latest clarification request has already been answered");
		const comment = await tx.attendanceDiscrepancyComment.create({ data: { discrepancyId: item.id, authorUserId: userId, clarificationDecisionId: request.id, body: body.trim() }, select: { id: true, discrepancyId: true, clarificationDecisionId: true, body: true, createdAt: true } });
		await recordAuditEvent({ prismaClient: tx, actorId: userId, action: "LECTURER_ATTENDANCE_DISCREPANCY_CLARIFICATION", entityType: "AttendanceDiscrepancy", entityId: item.id, metadata: { clarificationDecisionId: request.id, commentId: comment.id } });
		return comment;
	});
	} catch (error) {
		const target = (Array.isArray(error?.meta?.target) ? error.meta.target.join(" ") : String(error?.meta?.target ?? "")).toLowerCase();
		if (error?.code === "P2002" && (target.includes("attendance_discrepancy_comments_clarification_author_key") ||
			((target.includes("clarification_decision_id") || target.includes("clarificationdecisionid")) && (target.includes("author_user_id") || target.includes("authoruserid"))))) {
			throw new AppError(409, "The clarification request has already been answered");
		}
		throw error;
	}
}

const catSubmissionSelect = {
	id: true,
	status: true,
	rejectionReason: true,
	comments: true,
	createdAt: true,
	confirmedAt: true,
	verifiedAt: true,
	verifiedBy: {
		select: { id: true, staffNumber: true, user: { select: { displayName: true } } },
	},
	student: {
		select: { id: true, studentNumber: true, user: { select: { displayName: true } } },
	},
	assessment: {
		select: {
			id: true,
			code: true,
			name: true,
			type: true,
			courseUnitId: true,
			courseUnit: { select: { id: true, code: true, name: true } },
		},
	},
	attendanceRecord: {
		select: {
			id: true,
			status: true,
			locationVerified: true,
			recordedAt: true,
			session: {
				select: {
					id: true,
					sessionType: true,
					lecturerProfileId: true,
					courseUnitId: true,
					startsAt: true,
					endsAt: true,
				},
			},
		},
	},
};

function catSubmissionScope(lecturerProfileId, { courseUnitId, assessmentId } = {}) {
	return {
		...(assessmentId ? { assessmentId } : {}),
		assessment: {
			is: {
				...(courseUnitId ? { courseUnitId } : {}),
				type: "CAT",
			},
		},
		attendanceRecord: {
			is: {
				session: {
					is: {
						sessionType: "CAT",
						lecturerProfileId,
						...(courseUnitId ? { courseUnitId } : {}),
					},
				},
			},
		},
	};
}

function hasValidCatSubmissionSource(item) {
	return item?.attendanceRecord
		&& item.attendanceRecord.session?.sessionType === "CAT"
		&& item.assessment?.type === "CAT"
		&& item.assessment.courseUnitId === item.attendanceRecord.session.courseUnitId;
}

export async function listLecturerCatSubmissions(db, userId, { page = 1, limit = 20, status, courseUnitId, assessmentId } = {}) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	const where = {
		...catSubmissionScope(lecturer.id, { courseUnitId, assessmentId }),
		...(status ? { status } : {}),
	};
	const [items, total] = await db.$transaction([
		db.catSubmission.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			select: catSubmissionSelect,
		}),
		db.catSubmission.count({ where }),
	]);
	return {
		items: items.filter(hasValidCatSubmissionSource).map((item) => ({
			...item,
			academicYear: academicYearForDate(item.attendanceRecord.session.startsAt),
		})),
		pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
}

export async function getLecturerCatSubmission(db, userId, submissionId) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	const item = await db.catSubmission.findFirst({
		where: { id: submissionId, ...catSubmissionScope(lecturer.id) },
		select: catSubmissionSelect,
	});
	if (!item || !hasValidCatSubmissionSource(item)) throw new AppError(404, "CAT submission not found");
	return { ...item, academicYear: academicYearForDate(item.attendanceRecord.session.startsAt) };
}

async function applyLecturerCatSubmissionDecision(tx, userId, lecturer, item, { decision, comments, reason }) {
	const now = new Date();
	const status = decision === "VERIFY" ? "VERIFIED" : "REJECTED";
	const normalizedReason = decision === "REJECT" ? reason.trim() : null;
	const updated = await tx.catSubmission.updateMany({
		where: {
			id: item.id,
			status: "PENDING_REVIEW",
			verifiedByLecturerId: null,
			verifiedAt: null,
		},
		data: {
			status,
			verifiedByLecturerId: lecturer.id,
			verifiedAt: now,
			rejectionReason: normalizedReason,
			comments: decision === "VERIFY" ? (comments?.trim() || null) : null,
		},
	});
	if (updated.count !== 1) throw new AppError(409, "A CAT submission was decided concurrently; reload before reviewing");

	await recordAuditEvent({
		prismaClient: tx,
		actorId: userId,
		action: `CAT_SUBMISSION_${status}`,
		entityType: "CatSubmission",
		entityId: item.id,
		metadata: {
			assessmentId: item.assessment.id,
			attendanceRecordId: item.attendanceRecord.id,
			attendanceSessionId: item.attendanceRecord.session.id,
			previousStatus: item.status,
			status,
			...(normalizedReason ? { rejectionReason: normalizedReason } : {}),
		},
	});
	await enqueueNotificationOnce(tx, {
		dedupeKey: `CAT_SUBMISSION_DECISION:${item.id}:${status}`,
		eventType: `CAT_SUBMISSION_${status}`,
		entityType: "CatSubmission",
		entityId: item.id,
		recipientUserId: item.student.user.id,
		title: status === "VERIFIED" ? "CAT submission verified" : "CAT submission rejected",
		message: status === "VERIFIED"
			? `Your CAT submission for ${item.assessment.courseUnit.code} has been verified.`
			: `Your CAT submission for ${item.assessment.courseUnit.code} was rejected. Reason: ${normalizedReason}`,
	});
	const result = await tx.catSubmission.findUnique({
		where: { id: item.id },
		select: catSubmissionSelect,
	});
	return { ...result, academicYear: academicYearForDate(item.attendanceRecord.session.startsAt) };
}

function catSubmissionDecisionSelect() {
	return {
		...catSubmissionSelect,
		student: { select: { id: true, studentNumber: true, user: { select: { id: true, displayName: true } } } },
	};
}

export async function decideLecturerCatSubmission(db, userId, submissionId, input) {
	return db.$transaction(async (tx) => {
		const lecturer = await getDiscrepancyLecturer(tx, userId);
		const item = await tx.catSubmission.findFirst({
			where: { id: submissionId, ...catSubmissionScope(lecturer.id) },
			select: catSubmissionDecisionSelect(),
		});
		if (!item || !hasValidCatSubmissionSource(item)) throw new AppError(404, "CAT submission not found");
		if (item.status !== "PENDING_REVIEW") throw new AppError(409, "This CAT submission has already been decided");
		return applyLecturerCatSubmissionDecision(tx, userId, lecturer, item, input);
	});
}

export async function decideLecturerCatSubmissions(db, userId, { submissionIds, ...input }) {
	return db.$transaction(async (tx) => {
		const lecturer = await getDiscrepancyLecturer(tx, userId);
		const items = await tx.catSubmission.findMany({
			where: {
				id: { in: submissionIds },
				...catSubmissionScope(lecturer.id),
			},
			select: catSubmissionDecisionSelect(),
		});
		if (items.length !== submissionIds.length) {
			throw new AppError(404, "One or more CAT submissions were not found");
		}

		const itemsById = new Map(items.map((item) => [item.id, item]));
		const orderedItems = submissionIds.map((id) => itemsById.get(id));
		if (orderedItems.some((item) => !hasValidCatSubmissionSource(item))) {
			throw new AppError(404, "One or more CAT submissions were not found");
		}
		if (orderedItems.some((item) => item.status !== "PENDING_REVIEW")) {
			throw new AppError(409, "All selected CAT submissions must still be pending review");
		}

		const submissions = [];
		for (const item of orderedItems) {
			submissions.push(await applyLecturerCatSubmissionDecision(tx, userId, lecturer, item, input));
		}
		return { count: submissions.length, submissions };
	});
}

const examAttendanceRecordSelect = {
	id: true,
	status: true,
	locationVerified: true,
	recordedAt: true,
	examVerificationStatus: true,
	examVerifiedAt: true,
	examVerificationMethod: true,
	examVerificationActorAt: true,
	examRejectionReason: true,
	examComments: true,
	examVerifiedBy: { select: { id: true, staffNumber: true, user: { select: { displayName: true } } } },
	examVerificationActor: { select: { id: true, displayName: true } },
	student: { select: { id: true, studentNumber: true, user: { select: { displayName: true } } } },
	session: {
		select: {
			id: true,
			sessionType: true,
			lecturerProfileId: true,
			courseUnitId: true,
			startsAt: true,
			endsAt: true,
			courseUnit: { select: { id: true, code: true, name: true } },
			classroom: { select: { id: true, name: true } },
			assessment: {
				select: {
					id: true,
					code: true,
					name: true,
					type: true,
					courseUnitId: true,
					courseUnit: { select: { id: true, code: true, name: true } },
				},
			},
		},
	},
};

function isValidExamAttendanceRecord(item) {
	return item?.session?.sessionType === "EXAM"
		&& item.session.assessment?.type?.toUpperCase() === "EXAM"
		&& item.session.assessment.courseUnitId === item.session.courseUnitId;
}

function examAttendanceScope(lecturerProfileId, { courseUnitId, assessmentId } = {}) {
	return {
		session: {
			is: {
				sessionType: "EXAM",
				lecturerProfileId,
				...(courseUnitId ? { courseUnitId } : {}),
				...(assessmentId ? { assessmentId } : {}),
			},
		},
	};
}

export async function listLecturerExamAttendance(db, userId, { page = 1, limit = 20, status, courseUnitId, assessmentId } = {}) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	const where = {
		...examAttendanceScope(lecturer.id, { courseUnitId, assessmentId }),
		...(status ? { examVerificationStatus: status } : {}),
	};
	const [items, total] = await db.$transaction([
		db.attendanceRecord.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
			select: examAttendanceRecordSelect,
		}),
		db.attendanceRecord.count({ where }),
	]);
	const validItems = items.filter(isValidExamAttendanceRecord);
	return {
		items: validItems.map((item) => ({ ...item, academicYear: academicYearForDate(item.session.startsAt) })),
		pagination: { page, limit, total: validItems.length === items.length ? total : validItems.length, totalPages: Math.ceil((validItems.length === items.length ? total : validItems.length) / limit) },
	};
}

export async function getLecturerExamAttendanceRecord(db, userId, recordId) {
	const lecturer = await getDiscrepancyLecturer(db, userId);
	const item = await db.attendanceRecord.findFirst({
		where: { id: recordId, ...examAttendanceScope(lecturer.id) },
		select: examAttendanceRecordSelect,
	});
	if (!item || !isValidExamAttendanceRecord(item)) throw new AppError(404, "Examination attendance record not found");
	return { ...item, academicYear: academicYearForDate(item.session.startsAt) };
}

function examAttendanceDecisionSelect() {
	return {
		...examAttendanceRecordSelect,
		student: { select: { id: true, studentNumber: true, user: { select: { id: true, displayName: true } } } },
	};
}

async function applyLecturerExamAttendanceDecision(tx, userId, lecturer, item, { decision, comments, reason }) {
	const now = new Date();
	const status = decision === "VERIFY" ? "VERIFIED" : "REJECTED";
	const rejectionReason = decision === "REJECT" ? reason.trim() : null;
	const verificationComments = decision === "VERIFY" ? comments?.trim() || null : null;
	const updated = await tx.attendanceRecord.updateMany({
		where: {
			id: item.id,
			examVerificationStatus: "PENDING_REVIEW",
			examVerifiedByLecturerId: null,
			examVerifiedAt: null,
		},
		data: {
			examVerificationStatus: status,
			examVerifiedByLecturerId: lecturer.id,
			examVerifiedAt: now,
			examRejectionReason: rejectionReason,
			examComments: verificationComments,
		},
	});
	if (updated.count !== 1) throw new AppError(409, "An examination attendance record was decided concurrently; reload before reviewing");

	await recordAuditEvent({
		prismaClient: tx,
		actorId: userId,
		action: `EXAM_ATTENDANCE_${status}`,
		entityType: "AttendanceRecord",
		entityId: item.id,
		metadata: {
			assessmentId: item.session.assessment.id,
			attendanceSessionId: item.session.id,
			previousStatus: item.examVerificationStatus,
			status,
			...(rejectionReason ? { rejectionReason } : {}),
		},
	});
	await enqueueNotificationOnce(tx, {
		dedupeKey: `EXAM_ATTENDANCE_DECISION:${item.id}:${status}`,
		eventType: `EXAM_ATTENDANCE_${status}`,
		entityType: "AttendanceRecord",
		entityId: item.id,
		recipientUserId: item.student.user.id,
		title: status === "VERIFIED" ? "Examination attendance verified" : "Examination attendance rejected",
		message: status === "VERIFIED"
			? `Your examination attendance for ${item.session.courseUnit.code} has been verified.`
			: `Your examination attendance for ${item.session.courseUnit.code} was rejected. Reason: ${rejectionReason}`,
	});
	const result = await tx.attendanceRecord.findUnique({
		where: { id: item.id },
		select: examAttendanceRecordSelect,
	});
	return { ...result, academicYear: academicYearForDate(item.session.startsAt) };
}

export async function decideLecturerExamAttendance(db, userId, recordId, input) {
	return db.$transaction(async (tx) => {
		const lecturer = await getDiscrepancyLecturer(tx, userId);
		const item = await tx.attendanceRecord.findFirst({
			where: { id: recordId, ...examAttendanceScope(lecturer.id) },
			select: examAttendanceDecisionSelect(),
		});
		if (!item || !isValidExamAttendanceRecord(item)) throw new AppError(404, "Examination attendance record not found");
		if (item.examVerificationStatus !== "PENDING_REVIEW") throw new AppError(409, "This examination attendance record has already been decided");
		return applyLecturerExamAttendanceDecision(tx, userId, lecturer, item, input);
	});
}

export async function decideLecturerExamAttendanceRecords(db, userId, { recordIds, ...input }) {
	return db.$transaction(async (tx) => {
		const lecturer = await getDiscrepancyLecturer(tx, userId);
		const items = await tx.attendanceRecord.findMany({
			where: {
				id: { in: recordIds },
				...examAttendanceScope(lecturer.id),
			},
			select: examAttendanceDecisionSelect(),
		});
		if (items.length !== recordIds.length) {
			throw new AppError(404, "One or more examination attendance records were not found");
		}

		const itemsById = new Map(items.map((item) => [item.id, item]));
		const orderedItems = recordIds.map((id) => itemsById.get(id));
		if (orderedItems.some((item) => !isValidExamAttendanceRecord(item))) {
			throw new AppError(404, "One or more examination attendance records were not found");
		}
		if (orderedItems.some((item) => item.examVerificationStatus !== "PENDING_REVIEW")) {
			throw new AppError(409, "All selected examination attendance records must still be pending review");
		}

		const records = [];
		for (const item of orderedItems) {
			records.push(await applyLecturerExamAttendanceDecision(tx, userId, lecturer, item, input));
		}
		return { count: records.length, records };
	});
}
