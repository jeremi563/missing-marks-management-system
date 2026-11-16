import {
	createStudentEnrollmentRequests,
	decideEnrollmentRequests,
	listEnrollmentRequestsForReviewer,
	listStudentEnrollmentOptions,
} from "./enrollment-request.service.js";

export async function getStudentEnrollmentOptions(req, res, next) {
	try {
		const options = await listStudentEnrollmentOptions(req.app.locals.prisma, req.user.id);
		return res.status(200).json({ success: true, message: "Enrollment options retrieved successfully.", data: options });
	} catch (error) {
		return next(error);
	}
}

export async function postStudentEnrollmentRequests(req, res, next) {
	try {
		const requests = await createStudentEnrollmentRequests(req.app.locals.prisma, req.user.id, req.body);
		return res.status(201).json({ success: true, message: "Course enrollment requests submitted successfully.", data: requests });
	} catch (error) {
		return next(error);
	}
}

export async function getEnrollmentRequestsForReviewer(req, res, next) {
	try {
		const requests = await listEnrollmentRequestsForReviewer(req.app.locals.prisma, req.user.id, req.query.status);
		return res.status(200).json({ success: true, message: "Enrollment requests retrieved successfully.", count: requests.length, data: requests });
	} catch (error) {
		return next(error);
	}
}

export async function postEnrollmentRequestDecision(req, res, next) {
	try {
		const result = await decideEnrollmentRequests(req.app.locals.prisma, req.user.id, req.body);
		return res.status(200).json({ success: true, message: "Enrollment requests updated successfully.", data: result });
	} catch (error) {
		return next(error);
	}
}
