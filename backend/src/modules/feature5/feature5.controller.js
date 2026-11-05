import { sendSuccess } from "../../shared/utils/api-response.js";
import {
	createSpecialCase, decideAppeal, decideSpecialCase, getCodAppeal, getCodSpecialCase,
	getLecturerSpecialCase, getStudentAppeal, getStudentSpecialCase, listActiveSpecialCaseCategories,
	listCodAppeals, listCodSpecialCases, listOverdue, listPublicHolidays, listSpecialCaseCategories,
	listStudentAppeals, listStudentSpecialCases, listLecturerSpecialCases, savePublicHoliday, saveSpecialCaseCategory,
	startAssignedReportWork, listActiveAssessmentTypes, designateDepartmentCod,
} from "../../shared/services/feature5.service.js";

const handle = (fn, message, status = 200) => async (req, res, next) => {
	try {
		const data = await fn(req);
		return sendSuccess(res, message, data, status);
	} catch (error) { return next(error); }
};

export const getStudentAppeals = handle((req) => listStudentAppeals({ userId: req.user.id, ...req.query }), "Student appeals retrieved successfully");
export const getStudentAppealById = handle((req) => getStudentAppeal({ userId: req.user.id, appealId: req.params.appealId }), "Appeal retrieved successfully");
export const getStudentCases = handle((req) => listStudentSpecialCases({ userId: req.user.id, ...req.query }), "Student special cases retrieved successfully");
export const getStudentCaseById = handle((req) => getStudentSpecialCase({ userId: req.user.id, caseId: req.params.caseId }), "Special case retrieved successfully");
export const createStudentCase = handle((req) => createSpecialCase({ userId: req.user.id, role: "student", reportId: req.params.reportId, ...req.body }), "Special case submitted successfully", 201);
export const createLecturerCase = handle((req) => createSpecialCase({ userId: req.user.id, role: "lecturer", reportId: req.params.reportId, ...req.body }), "Special case submitted successfully", 201);
export const startReportWork = handle((req) => startAssignedReportWork({ userId: req.user.id, reportId: req.params.reportId }), "Report work started successfully");
export const getLecturerCaseById = handle((req) => getLecturerSpecialCase({ userId: req.user.id, caseId: req.params.caseId }), "Special case retrieved successfully");
export const getLecturerCases = handle((req) => listLecturerSpecialCases({ userId: req.user.id, ...req.query }), "Lecturer special cases retrieved successfully");
export const getActiveCategories = handle(() => listActiveSpecialCaseCategories(), "Special-case categories retrieved successfully");
export const getAssessmentTypes = handle(() => listActiveAssessmentTypes(), "Assessment types retrieved successfully");
export const setDepartmentCod = handle((req) => designateDepartmentCod({ actorUserId: req.user.id, departmentId: req.params.departmentId, codUserId: req.body.codUserId }), "Department COD designation updated successfully");
export const getCodCategories = handle((req) => listSpecialCaseCategories({ userId: req.user.id }), "Special-case categories retrieved successfully");
export const createCodCategory = handle((req) => saveSpecialCaseCategory({ userId: req.user.id, ...req.body }), "Special-case category created successfully", 201);
export const updateCodCategory = handle((req) => saveSpecialCaseCategory({ userId: req.user.id, id: req.params.id, ...req.body }), "Special-case category updated successfully");
export const getCodAppeals = handle((req) => listCodAppeals({ userId: req.user.id, ...req.query }), "Departmental appeals retrieved successfully");
export const getCodAppealById = handle((req) => getCodAppeal({ userId: req.user.id, appealId: req.params.appealId }), "Appeal retrieved successfully");
export const decideCodAppeal = handle((req) => decideAppeal({ userId: req.user.id, appealId: req.params.appealId, ...req.body }), "Appeal decision recorded successfully");
export const getCodCases = handle((req) => listCodSpecialCases({ userId: req.user.id, ...req.query }), "Departmental special cases retrieved successfully");
export const getCodCaseById = handle((req) => getCodSpecialCase({ userId: req.user.id, caseId: req.params.caseId }), "Special case retrieved successfully");
export const decideCodCase = handle((req) => decideSpecialCase({ userId: req.user.id, caseId: req.params.caseId, ...req.body }), "Special-case decision recorded successfully");
export const getOverdueReports = handle((req) => listOverdue({ userId: req.user.id, kind: "reports", ...req.query }), "Overdue reports retrieved successfully");
export const getOverdueAppeals = handle((req) => listOverdue({ userId: req.user.id, kind: "appeals", ...req.query }), "Overdue appeals retrieved successfully");
export const getOverdueCases = handle((req) => listOverdue({ userId: req.user.id, kind: "special-cases", ...req.query }), "Overdue special cases retrieved successfully");
export const getHolidayCalendar = handle((req) => listPublicHolidays(req.query), "Public holiday calendar retrieved successfully");
export const createHoliday = handle((req) => savePublicHoliday({ userId: req.user.id, ...req.body }), "Public holiday created successfully", 201);
export const updateHoliday = handle((req) => savePublicHoliday({ userId: req.user.id, id: req.params.id, ...req.body }), "Public holiday updated successfully");
export const deleteHoliday = handle((req) => savePublicHoliday({ userId: req.user.id, id: req.params.id, remove: true }), "Public holiday deleted successfully");
