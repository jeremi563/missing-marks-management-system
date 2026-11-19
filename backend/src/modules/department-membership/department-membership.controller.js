import {
	decideCodDepartmentMembershipRequest,
	getLecturerDepartmentOptions,
	listCodDepartmentMembershipRequests,
} from "./department-membership.service.js";

export async function getLecturerDepartments(req, res, next) {
	try {
		const result = await getLecturerDepartmentOptions(req.app.locals.prisma, req.user.id);
		return res.status(200).json({ success: true, message: "Lecturer department options retrieved successfully", data: result });
	} catch (error) {
		return next(error);
	}
}

export async function getCodDepartmentRequests(req, res, next) {
	try {
		const result = await listCodDepartmentMembershipRequests(req.app.locals.prisma, req.user.id);
		return res.status(200).json({ success: true, message: "Pending lecturer department requests retrieved successfully", count: result.length, data: result });
	} catch (error) {
		return next(error);
	}
}

export async function patchCodDepartmentRequestDecision(req, res, next) {
	try {
		const result = await decideCodDepartmentMembershipRequest(
			req.app.locals.prisma,
			req.user.id,
			req.params.id,
			req.body.status,
		);
		return res.status(200).json({ success: true, message: "Lecturer department request decision saved", data: result });
	} catch (error) {
		return next(error);
	}
}
