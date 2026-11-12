import {
  getAssignedReports,
  getAssignedReportById,
  getReportComments,
  createReportComment,
  submitReportDecision,
  escalateAssignedReport,
  submitMarkCorrection,
  createAttendanceSession,
  getAttendanceSessions,
  getAttendanceSessionById,
  startAttendanceSession,
  endAttendanceSession,
  getAttendanceSessionRecords,
} from './lecturer.service.js';

export const getReports = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const { status, page, limit } = req.query;

    const result = await getAssignedReports(
      prisma,
      lecturerUserId,
      { status, page, limit }
    );

    return res.status(200).json({
      success: true,
      message: 'Assigned missing-mark reports retrieved successfully.',
      count: result.reports.length,
      data: result.reports,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getAssignedCourseUnits = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const prisma = req.app.locals.prisma;
    if (!prisma) {
      return res.status(500).json({ success: false, message: 'Database service is not configured.' });
    }

    const lecturer = await prisma.lecturerProfile.findUnique({
      where: { userId: lecturerUserId },
      select: {
        unitAssignments: {
          orderBy: { courseUnit: { code: 'asc' } },
          select: {
            id: true,
            createdAt: true,
            courseUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                department: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });

    if (!lecturer) {
      return res.status(404).json({ success: false, message: 'Lecturer profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Assigned course units retrieved successfully.',
      count: lecturer.unitAssignments.length,
      data: lecturer.unitAssignments,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAssignedCourseUnitAssessments = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const prisma = req.app.locals.prisma;
    if (!prisma) {
      return res.status(500).json({ success: false, message: 'Database service is not configured.' });
    }

    const lecturer = await prisma.lecturerProfile.findUnique({
      where: { userId: lecturerUserId },
      select: { id: true },
    });
    if (!lecturer) {
      return res.status(404).json({ success: false, message: 'Lecturer profile not found.' });
    }

    const courseUnit = await prisma.courseUnit.findFirst({
      where: {
        id: req.params.courseUnitId,
        lecturerMappings: { some: { lecturerProfileId: lecturer.id } },
      },
      select: { id: true },
    });
    if (!courseUnit) {
      return res.status(404).json({ success: false, message: 'Assigned course unit not found.' });
    }

    const assessments = await prisma.assessment.findMany({
      where: { courseUnitId: courseUnit.id, type: req.query.type },
      orderBy: [{ assessmentDate: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, type: true, assessmentDate: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Course unit assessments retrieved successfully.',
      count: assessments.length,
      data: assessments,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAssignedStudents = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const prisma = req.app.locals.prisma;
    if (!prisma) {
      return res.status(500).json({ success: false, message: 'Database service is not configured.' });
    }

    const lecturer = await prisma.lecturerProfile.findUnique({
      where: { userId: lecturerUserId },
      select: { id: true },
    });
    if (!lecturer) {
      return res.status(404).json({ success: false, message: 'Lecturer profile not found.' });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const where = {
      courseUnit: {
        lecturerMappings: { some: { lecturerProfileId: lecturer.id } },
      },
    };
    const [total, enrollments] = await Promise.all([
      prisma.unitEnrollment.count({ where }),
      prisma.unitEnrollment.findMany({
        where,
        orderBy: [
          { student: { user: { displayName: 'asc' } } },
          { courseUnit: { code: 'asc' } },
          { academicPeriod: { name: 'desc' } },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              studentNumber: true,
              officialEmail: true,
              user: { select: { displayName: true, email: true, isActive: true } },
            },
          },
          courseUnit: {
            select: {
              id: true,
              code: true,
              name: true,
              department: { select: { name: true, code: true } },
            },
          },
          academicPeriod: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Students enrolled in your assigned course units retrieved successfully.',
      count: enrollments.length,
      data: enrollments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

// Feature 2: Retrieve individual missing-mark report details
export const getReportById = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const report = await getAssignedReportById(
      prisma,
      lecturerUserId,
      req.params.reportId
    );

    return res.status(200).json({
      success: true,
      message: 'Missing-mark report retrieved successfully.',
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// Feature 3: Retrieve comments for an assigned report
export const getComments = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const comments = await getReportComments(
      prisma,
      lecturerUserId,
      req.params.reportId
    );

    return res.status(200).json({
      success: true,
      message: 'Report comments retrieved successfully.',
      count: comments.length,
      data: comments,
    });
  } catch (error) {
    next(error);
  }
};

// Feature 3: Add a comment to an assigned report
export const addComment = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const comment = await createReportComment(
      prisma,
      lecturerUserId,
      req.params.reportId,
      req.body.body
    );

    return res.status(201).json({
      success: true,
      message: 'Report comment added successfully.',
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

// Feature 4: Submit a lecturer decision on an assigned report
export const submitDecision = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const { decision, reason, assessmentTypeId, assessmentTypeOtherDescription } = req.body;

    const result = await submitReportDecision(
      prisma,
      lecturerUserId,
      req.params.reportId,
      decision,
      reason,
      { assessmentTypeId, assessmentTypeOtherDescription }
    );

    return res.status(200).json({
      success: true,
      message: 'Report decision submitted successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Feature 4: Escalate a completed lecturer decision to COD review
export const escalateReportController = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;
    if (!lecturerUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const prisma = req.app.locals.prisma;
    if (!prisma) {
      return res.status(500).json({ success: false, message: 'Database service is not configured.' });
    }

    const result = await escalateAssignedReport(
      prisma,
      lecturerUserId,
      req.params.reportId,
      req.body.reason
    );

    return res.status(200).json({
      success: true,
      message: 'Report escalated for COD review.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Feature 5: Submit a mark-correction proposal
export const submitCorrection = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const { proposedValue, reason } = req.body;

    const result = await submitMarkCorrection(
      prisma,
      lecturerUserId,
      req.params.reportId,
      proposedValue,
      reason
    );

    return res.status(201).json({
      success: true,
      message: 'Mark-correction proposal submitted successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Feature 6: Create a unified attendance session
export const createAttendanceSessionController = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const result = await createAttendanceSession(
      prisma,
      lecturerUserId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: 'Attendance session created successfully.',
      data: {
        session: result.session,
        qrToken: result.qrToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Feature 6: Retrieve lecturer attendance sessions
export const getAttendanceSessionsController = async (req, res, next) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const {
      courseUnitId,
      sessionType,
      status,
      page,
      limit,
    } = req.query;

    const result = await getAttendanceSessions(
      prisma,
      lecturerUserId,
      {
        courseUnitId,
        sessionType,
        status,
        page,
        limit,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance sessions retrieved successfully.',
      count: result.sessions.length,
      data: result.sessions,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// Feature 6: Retrieve an individual attendance session
export const getAttendanceSessionByIdController = async (
  req,
  res,
  next
) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const { sessionId } = req.params;

    const session = await getAttendanceSessionById(
      prisma,
      lecturerUserId,
      sessionId
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance session retrieved successfully.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};


 // Start attendance session
export const startAttendanceSessionController = async (
  req,
  res,
  next
) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const session = await startAttendanceSession(
      prisma,
      lecturerUserId,
      req.params.sessionId
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance session started successfully.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

// End attendance session
export const endAttendanceSessionController = async (
  req,
  res,
  next
) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const session = await endAttendanceSession(
      prisma,
      lecturerUserId,
      req.params.sessionId
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance session ended successfully.',
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve attendance records
export const getAttendanceSessionRecordsController = async (
  req,
  res,
  next
) => {
  try {
    const lecturerUserId = req.user?.id;

    if (!lecturerUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const prisma = req.app.locals.prisma;

    if (!prisma) {
      return res.status(500).json({
        success: false,
        message: 'Database service is not configured.',
      });
    }

    const records = await getAttendanceSessionRecords(
      prisma,
      lecturerUserId,
      req.params.sessionId
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance records retrieved successfully.',
      count: records.length,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};
