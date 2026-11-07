import {
	createLecturerAttendanceDiscrepancy,
	getLecturerAttendanceDiscrepancy,
	listLecturerAttendanceDiscrepancies,
	reviewStudentAttendanceDiscrepancy,
	respondToLecturerAttendanceDiscrepancy,
} from "./lecturer.service.js";
import { sendSuccess } from "../../shared/utils/api-response.js";

export async function createLecturerDiscrepancy(req, res, next) {
	try {
		const result = await createLecturerAttendanceDiscrepancy(req.app.locals.prisma, req.user.id, req.body);
		return sendSuccess(res, "Attendance discrepancy submitted successfully", result, 201);
	} catch (error) { return next(error); }
}

export async function getLecturerDiscrepancies(req, res, next) {
	try {
		const result = await listLecturerAttendanceDiscrepancies(req.app.locals.prisma, req.user.id, req.query);
		return sendSuccess(res, "Attendance discrepancies retrieved successfully", result.items, 200, result.pagination);
	} catch (error) { return next(error); }
}

export async function getLecturerDiscrepancy(req, res, next) {
	try {
		const result = await getLecturerAttendanceDiscrepancy(req.app.locals.prisma, req.user.id, req.params.id);
		return sendSuccess(res, "Attendance discrepancy retrieved successfully", result);
	} catch (error) { return next(error); }
}

export async function reviewLecturerDiscrepancy(req, res, next) {
	try {
		const result = await reviewStudentAttendanceDiscrepancy(req.app.locals.prisma, req.user.id, req.params.id, req.body);
		return sendSuccess(res, "Attendance discrepancy review recorded successfully", result);
	} catch (error) { return next(error); }
}

export async function respondLecturerDiscrepancy(req, res, next) {
	try {
		const result = await respondToLecturerAttendanceDiscrepancy(req.app.locals.prisma, req.user.id, req.params.id, req.body.body);
		return sendSuccess(res, "Attendance clarification submitted successfully", result, 201);
	} catch (error) { return next(error); }
}
