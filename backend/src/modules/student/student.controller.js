import { getStudentProfile } from "./student.service.js";

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
