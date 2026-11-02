import { getStudentProfile, getStudentReports, getStudentReportById } from "./student.service.js";

export async function getProfile(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const profile = await getStudentProfile(prisma, userId);
		return res.status(200).json({
			success: true,
			message: "Student profile retrieved successfully.",
			data: profile,
		});
	} catch (error) {
		return next(error);
	}
}

export async function getReports(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const result = await getStudentReports(prisma, userId, req.validatedQuery);
		return res.status(200).json({
			success: true,
			message: "Student reports retrieved successfully.",
			count: result.reports.length,
			data: result.reports,
			pagination: result.pagination,
		});
	} catch (error) {
		return next(error);
	}
}

export async function getReportById(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const report = await getStudentReportById(prisma, userId, req.params.reportId);
		return res.status(200).json({
			success: true,
			message: "Student report retrieved successfully.",
			data: report,
		});
	} catch (error) {
		return next(error);
	}
}
