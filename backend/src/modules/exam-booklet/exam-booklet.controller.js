import {
	allocateExamBooklets,
	listStudentExamBooklets,
	scanStudentExamBooklet,
	previewInvigilatorExamBooklet,
	scanInvigilatorExamBooklet,
	manualLookupExamBooklet,
	listExamBookletScans,
	replaceExamBooklet,
} from "./exam-booklet.service.js";

function prisma(req) {
	return req.app.locals.prisma;
}

export async function postExamBookletAllocations(req, res, next) {
	try {
		const result = await allocateExamBooklets(prisma(req), req.user.id, req.validatedParams.sessionId);
		return res.status(200).json({ success: true, message: "Examination booklets allocated.", data: result });
	} catch (error) {
		return next(error);
	}
}

export async function getStudentExamBooklets(req, res, next) {
	try {
		const data = await listStudentExamBooklets(prisma(req), req.user.id);
		return res.status(200).json({ success: true, message: "Your examination booklets were retrieved.", count: data.length, data });
	} catch (error) {
		return next(error);
	}
}

export async function postStudentExamBookletScan(req, res, next) {
	try {
		const data = await scanStudentExamBooklet(prisma(req), req.user.id, req.validatedBody);
		return res.status(200).json({ success: true, message: "Examination booklet verified.", data });
	} catch (error) {
		return next(error);
	}
}

export async function postInvigilatorExamBookletPreview(req, res, next) {
	try {
		const { sessionId } = req.validatedParams;
		const data = await previewInvigilatorExamBooklet(prisma(req), req.user.id, sessionId, req.validatedBody.token);
		return res.status(200).json({ success: true, message: "Confirm the student's identity against this allocation.", data });
	} catch (error) {
		return next(error);
	}
}

export async function postInvigilatorExamBookletScan(req, res, next) {
	try {
		const data = await scanInvigilatorExamBooklet(prisma(req), req.user.id, req.validatedParams.sessionId, req.validatedBody);
		return res.status(200).json({ success: true, message: "Examination booklet verified.", data });
	} catch (error) {
		return next(error);
	}
}

export async function postExamBookletManualLookup(req, res, next) {
	try {
		const data = await manualLookupExamBooklet(prisma(req), req.user.id, req.validatedParams.sessionId, req.validatedBody);
		return res.status(200).json({ success: true, message: "Examination booklet verified by confirmed manual lookup.", data });
	} catch (error) {
		return next(error);
	}
}

export async function getExamBookletScanHistory(req, res, next) {
	try {
		const result = await listExamBookletScans(prisma(req), req.user.id, req.validatedParams.sessionId, req.validatedQuery);
		return res.status(200).json({ success: true, message: "Examination booklet scan history retrieved.", count: result.items.length, data: result.items, pagination: result.pagination });
	} catch (error) {
		return next(error);
	}
}

async function postBookletReplacement(req, res, next, role) {
	try {
		const data = await replaceExamBooklet(prisma(req), req.user.id, role, req.validatedParams.bookletId, req.validatedBody.reason);
		return res.status(201).json({ success: true, message: "Replacement examination booklet issued.", data });
	} catch (error) {
		return next(error);
	}
}

export function postLecturerExamBookletReplacement(req, res, next) {
	return postBookletReplacement(req, res, next, "lecturer");
}

export function postCodExamBookletReplacement(req, res, next) {
	return postBookletReplacement(req, res, next, "cod");
}
