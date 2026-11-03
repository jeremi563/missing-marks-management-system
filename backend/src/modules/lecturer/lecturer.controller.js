import {
  getAssignedReports,
  getAssignedReportById,
  getReportComments,
  createReportComment,
  submitReportDecision,
  submitMarkCorrection,
  createAttendanceSession,
  getAttendanceSessions,
  getAttendanceSessionById,
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

    const { decision, reason } = req.body;

    const result = await submitReportDecision(
      prisma,
      lecturerUserId,
      req.params.reportId,
      decision,
      reason
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