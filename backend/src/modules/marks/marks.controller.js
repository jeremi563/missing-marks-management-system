import { sendSuccess } from "../../shared/utils/api-response.js";
import {
	decideCodMarkCorrection,
	getAssessmentRoster,
	getCodMarkCorrection,
	getLecturerMarkOptions,
	getLecturerReportCorrections,
	getStudentMarks,
	listCodMarkCorrections,
	submitInitialMarks,
} from "./marks.service.js";

export async function getLecturerMarkOptionsController(req, res, next) {
	try {
		const data = await getLecturerMarkOptions({ db: req.app.locals.prisma, userId: req.user.id });
		return sendSuccess(res, "Lecturer mark options retrieved successfully", data);
	} catch (error) {
		return next(error);
	}
}

export async function getAssessmentRosterController(req, res, next) {
	try {
		const data = await getAssessmentRoster({
			db: req.app.locals.prisma,
			userId: req.user.id,
			assessmentId: req.params.assessmentId,
			academicPeriodId: req.query.academicPeriodId,
		});
		return sendSuccess(res, "Assessment roster retrieved successfully", data);
	} catch (error) {
		return next(error);
	}
}

export async function postInitialMarksController(req, res, next) {
	try {
		const data = await submitInitialMarks({
			db: req.app.locals.prisma,
			userId: req.user.id,
			assessmentId: req.params.assessmentId,
			...req.body,
		});
		return sendSuccess(res, "Initial marks submitted successfully", data, 201);
	} catch (error) {
		return next(error);
	}
}

export async function getLecturerReportCorrectionsController(req, res, next) {
	try {
		const data = await getLecturerReportCorrections({
			db: req.app.locals.prisma,
			userId: req.user.id,
			reportId: req.params.reportId,
		});
		return sendSuccess(res, "Report mark-correction history retrieved successfully", data);
	} catch (error) {
		return next(error);
	}
}

export async function getCodMarkCorrectionsController(req, res, next) {
	try {
		const data = await listCodMarkCorrections({ db: req.app.locals.prisma, userId: req.user.id, ...req.query });
		return sendSuccess(res, "Mark-correction queue retrieved successfully", data.items, 200, { pagination: data.pagination });
	} catch (error) {
		return next(error);
	}
}

export async function getCodMarkCorrectionController(req, res, next) {
	try {
		const data = await getCodMarkCorrection({
			db: req.app.locals.prisma,
			userId: req.user.id,
			correctionId: req.params.correctionId,
		});
		return sendSuccess(res, "Mark-correction details retrieved successfully", data);
	} catch (error) {
		return next(error);
	}
}

export async function postCodMarkCorrectionDecisionController(req, res, next) {
	try {
		const data = await decideCodMarkCorrection({
			db: req.app.locals.prisma,
			userId: req.user.id,
			correctionId: req.params.correctionId,
			...req.body,
		});
		return sendSuccess(res, "Mark-correction decision recorded successfully", data);
	} catch (error) {
		return next(error);
	}
}

export async function getStudentMarksController(req, res, next) {
	try {
		const data = await getStudentMarks({
			db: req.app.locals.prisma,
			userId: req.user.id,
			...req.query,
		});
		return sendSuccess(res, "Student marks retrieved successfully", data);
	} catch (error) {
		return next(error);
	}
}
