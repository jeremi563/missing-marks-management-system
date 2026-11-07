import { getStudentProfile, getStudentReports, getStudentReportById, submitMissingMarkReport, getStudentAttendanceHistory, getStudentNotifications, updateStudentReport, withdrawStudentReport, getStudentReportComments, addStudentClarification, submitStudentAppeal, markStudentNotificationRead, createStudentAttendanceDiscrepancy, listStudentAttendanceDiscrepancies, getStudentAttendanceDiscrepancy, respondToStudentAttendanceDiscrepancy } from "./student.service.js";

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

export async function createReport(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const report = await submitMissingMarkReport(prisma, userId, req.validatedBody);
		return res.status(201).json({
			success: true,
			message: "Missing-mark report submitted successfully.",
			data: report,
		});
	} catch (error) {
		return next(error);
	}
}

export async function getAttendance(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const result = await getStudentAttendanceHistory(prisma, userId, req.validatedQuery);
		return res.status(200).json({
			success: true,
			message: "Student attendance history retrieved successfully.",
			count: result.records.length,
			data: result.records,
			pagination: result.pagination,
		});
	} catch (error) {
		return next(error);
	}
}

export async function getNotifications(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const result = await getStudentNotifications(prisma, userId, req.validatedQuery);
		return res.status(200).json({
			success: true,
			message: "Student notifications retrieved successfully.",
			count: result.notifications.length,
			unreadCount: result.unreadCount,
			data: result.notifications,
			pagination: result.pagination,
		});
	} catch (error) {
		return next(error);
	}
}

export async function markNotificationRead(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const notification = await markStudentNotificationRead(prisma, userId, req.params.notificationId);
		return res.status(200).json({
			success: true,
			message: "Notification marked as read.",
			data: notification,
		});
	} catch (error) {
		return next(error);
	}
}

export async function updateReport(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const report = await updateStudentReport(prisma, userId, req.params.reportId, req.validatedBody);
		return res.status(200).json({
			success: true,
			message: "Missing-mark report updated successfully.",
			data: report,
		});
	} catch (error) {
		return next(error);
	}
}

export async function withdrawReport(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const report = await withdrawStudentReport(prisma, userId, req.params.reportId);
		return res.status(200).json({
			success: true,
			message: "Missing-mark report withdrawn successfully.",
			data: report,
		});
	} catch (error) {
		return next(error);
	}
}

export async function getReportComments(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const comments = await getStudentReportComments(prisma, userId, req.params.reportId);
		return res.status(200).json({
			success: true,
			message: "Student report comments retrieved successfully.",
			count: comments.length,
			data: comments,
		});
	} catch (error) {
		return next(error);
	}
}

export async function addClarification(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const comment = await addStudentClarification(prisma, userId, req.params.reportId, req.validatedBody.body);
		return res.status(201).json({
			success: true,
			message: "Clarification submitted successfully.",
			data: comment,
		});
	} catch (error) {
		return next(error);
	}
}

export async function createAttendanceDiscrepancy(req, res, next) {
	try {
		const result = await createStudentAttendanceDiscrepancy(req.app.locals.prisma, req.user.id, req.validatedBody);
		return res.status(201).json({ success: true, message: "Attendance discrepancy submitted for lecturer review.", data: result });
	} catch (error) { return next(error); }
}

export async function getAttendanceDiscrepancies(req, res, next) {
	try {
		const result = await listStudentAttendanceDiscrepancies(req.app.locals.prisma, req.user.id, req.query);
		return res.status(200).json({ success: true, message: "Attendance discrepancies retrieved successfully.", data: result.items, pagination: result.pagination });
	} catch (error) { return next(error); }
}

export async function getAttendanceDiscrepancy(req, res, next) {
	try {
		const result = await getStudentAttendanceDiscrepancy(req.app.locals.prisma, req.user.id, req.params.id);
		return res.status(200).json({ success: true, message: "Attendance discrepancy retrieved successfully.", data: result });
	} catch (error) { return next(error); }
}

export async function respondAttendanceDiscrepancy(req, res, next) {
	try {
		const result = await respondToStudentAttendanceDiscrepancy(req.app.locals.prisma, req.user.id, req.params.id, req.validatedBody.body);
		return res.status(201).json({ success: true, message: "Attendance clarification submitted successfully.", data: result });
	} catch (error) { return next(error); }
}

export async function submitAppeal(req, res, next) {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required." });
		}

		const prisma = req.app.locals.prisma;
		if (!prisma) {
			return res.status(500).json({ success: false, message: "Database service is not configured." });
		}

		const appeal = await submitStudentAppeal(prisma, userId, req.params.reportId, req.validatedBody);
		return res.status(201).json({
			success: true,
			message: "Appeal submitted successfully.",
			data: appeal,
		});
	} catch (error) {
		return next(error);
	}
}
