
import { createHash, randomBytes } from 'node:crypto';
import { recordAuditEvent } from '../../shared/services/audit.service.js';
import { AppError } from '../../shared/utils/app-error.js';
import { loadAttendanceDiscrepancySource } from '../../shared/services/attendance-discrepancy-source.service.js';
import { evaluateConfiguredAttendanceEligibility } from '../../shared/services/eligibility.service.js';
import { createNotification } from '../../shared/services/notification.service.js';
import { isActiveCodDepartmentMember } from '../../shared/services/designated-cod-authorization.service.js';
import { academicYearForDate, academicYearForPeriod } from '../../shared/utils/academic-year.js';

function attendanceYearBounds(academicYear) {
  const startYear = Number(academicYear?.slice(0, 4));
  if (!Number.isInteger(startYear)) return null;
  return {
    startsAt: new Date(Date.UTC(startYear, 7, 1)),
    endsAt: new Date(Date.UTC(startYear + 1, 7, 1)),
  };
}

function isPresentStatus(status) {
  return ['PRESENT', 'ATTENDED'].includes(String(status).toUpperCase());
}

async function getReportAttendanceReview(prisma, report) {
  const academicYear = academicYearForPeriod(report.academicPeriod);
  const bounds = attendanceYearBounds(academicYear);
  if (!bounds) {
    return {
      academicYear: null,
      assessments: {
        CAT: { status: 'unknown', items: [] },
        EXAM: { status: 'unknown', items: [] },
      },
      classAttendance: { attendedSessions: 0, applicableSessions: 0, percentage: null, minimumPercentage: null, meetsRequirement: null },
    };
  }

  const [assessments, classSessions] = await Promise.all([
    prisma.assessment.findMany({
      where: {
        courseUnitId: report.courseUnitId,
        type: { in: ['CAT', 'EXAM'] },
        OR: [
          { assessmentDate: { gte: bounds.startsAt, lt: bounds.endsAt } },
          { sessions: { some: { startsAt: { gte: bounds.startsAt, lt: bounds.endsAt } } } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        attendanceRecords: {
          where: { studentProfileId: report.studentProfileId },
          select: { status: true },
        },
        sessions: {
          where: {
            sessionType: { in: ['CAT', 'EXAM'] },
            status: 'completed',
            startsAt: { gte: bounds.startsAt, lt: bounds.endsAt },
          },
          select: {
            id: true,
            records: {
              where: { studentProfileId: report.studentProfileId },
              select: { status: true },
            },
          },
        },
      },
    }),
    prisma.attendanceSession.findMany({
      where: {
        courseUnitId: report.courseUnitId,
        sessionType: 'CLASS',
        status: 'completed',
        startsAt: { gte: bounds.startsAt, lt: bounds.endsAt },
      },
      select: {
        id: true,
        records: {
          where: { studentProfileId: report.studentProfileId },
          select: { status: true },
        },
      },
    }),
  ]);

  const assessmentGroups = Object.fromEntries(['CAT', 'EXAM'].map((type) => {
    const items = assessments.filter((assessment) => assessment.type.toUpperCase() === type).map((assessment) => {
      const attendanceRows = assessment.attendanceRecords;
      const hasPresentRecord = attendanceRows.some(({ status }) => isPresentStatus(status))
        || assessment.sessions.some((session) => session.records.some(({ status }) => isPresentStatus(status)));
      const hasExplicitAbsentRecord = attendanceRows.some(({ status }) => String(status).toUpperCase() === 'ABSENT');
      const status = hasPresentRecord
        ? 'present'
        : hasExplicitAbsentRecord || assessment.sessions.length > 0
          ? 'absent'
          : 'unknown';
      return {
        assessmentId: assessment.id,
        name: assessment.name,
        code: assessment.code,
        status,
        completedSessions: assessment.sessions.length,
      };
    });
    const status = items.length === 0 || items.some((item) => item.status === 'unknown')
      ? 'unknown'
      : items.some((item) => item.status === 'absent')
        ? 'absent'
        : 'present';
    return [type, { status, items }];
  }));

  const attendedSessions = classSessions.filter((session) => session.records.some(({ status }) => isPresentStatus(status))).length;
  const classAttendance = classSessions.length
    ? await evaluateConfiguredAttendanceEligibility({
      db: prisma,
      attendedSessions,
      applicableSessions: classSessions.length,
    })
    : { percentage: null, meetsRequirement: null, minimumPercentage: null };

  return {
    academicYear,
    assessments: assessmentGroups,
    classAttendance: {
      attendedSessions,
      applicableSessions: classSessions.length,
      ...classAttendance,
    },
  };
}

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
  const assignment = await prisma.courseUnitLecturer.findFirst({
    where: {
      courseUnitId: sessionData.courseUnitId,
      lecturerProfileId: lecturer.id,
      academicYear: academicYearForDate(sessionData.startsAt),
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

export const completeExpiredAttendanceSessions = async (prisma, now = new Date()) => {
  const result = await prisma.attendanceSession.updateMany({
    where: {
      status: { in: ['scheduled', 'active'] },
      endsAt: { lte: now },
    },
    data: {
      status: 'completed',
      accessTokenHash: null,
    },
  });
  return result.count;
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

  const result = await prisma.attendanceSession.updateMany({
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

return prisma.attendanceSession.findUnique({
  where: { id: sessionId },
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
    select: { id: true },
  });

  if (!session) {
    const error = new Error('Attendance session not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.attendanceRecord.findMany({
    where: { sessionId },
    select: {
      id: true,
      status: true,
      locationVerified: true,
      recordedAt: true,
      student: {
        select: {
          id: true,
          studentNumber: true,
        },
      },
    },
    orderBy: { recordedAt: 'desc' },
  });
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
	const assignment = await db.courseUnitLecturer.findFirst({ where: { courseUnitId: context.courseUnitId, lecturerProfileId: lecturer.id, academicYear: context.academicYear }, select: { id: true } });
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
