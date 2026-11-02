
import {
  getAssignedReports,
  getAssignedReportById,
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

//individual missing marks details  :: feature 2
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