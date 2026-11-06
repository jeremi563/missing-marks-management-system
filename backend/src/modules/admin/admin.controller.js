import { sendSuccess } from "../../shared/utils/api-response.js";
import { createAdminUser, listAdminUsers, updateAdminUser } from "./admin.service.js";
import * as academic from "./academic.service.js";
import { listAuditLogs, listReportSummaries, listSettings, updateSetting } from "./operations.service.js";
import { exportAuditLogs, exportReportSummaries } from "./export.service.js";
import { toCsv } from "./csv.js";

export async function getUsers(req, res, next) {
	try {
		const result = await listAdminUsers({ db: req.app.locals.prisma, ...req.query });
		return sendSuccess(res, "Administrator users retrieved successfully", result.users, 200, result.pagination);
	} catch (error) { return next(error); }
}

export async function createUser(req, res, next) {
	try {
		const user = await createAdminUser({ db: req.app.locals.prisma, actorUserId: req.user.id, ...req.body });
		return sendSuccess(res, "User created successfully", user, 201);
	} catch (error) { return next(error); }
}

export async function updateUser(req, res, next) {
	try {
		const user = await updateAdminUser({ db: req.app.locals.prisma, actorUserId: req.user.id, userId: req.params.id, ...req.body });
		return sendSuccess(res, "User updated successfully", user);
	} catch (error) { return next(error); }
}

export async function getSettings(req, res, next) {
	try { const result = await listSettings({ db: req.app.locals.prisma, ...req.query }); return sendSuccess(res, "System settings retrieved successfully", result.settings, 200, result.pagination); } catch (error) { return next(error); }
}

export async function patchSetting(req, res, next) {
	try { const result = await updateSetting({ db: req.app.locals.prisma, actorUserId: req.user.id, key: req.params.key, ...req.body }); return sendSuccess(res, "System setting updated successfully", result); } catch (error) { return next(error); }
}

export async function getReportSummaries(req, res, next) {
	try { const result = await listReportSummaries({ db: req.app.locals.prisma, ...req.query }); return sendSuccess(res, "Administrator report summaries retrieved successfully", { reports: result.reports, summary: result.summary }, 200, result.pagination); } catch (error) { return next(error); }
}

export async function getAuditLogs(req, res, next) {
	try { const result = await listAuditLogs({ db: req.app.locals.prisma, ...req.query }); return sendSuccess(res, "Audit logs retrieved successfully", result.logs, 200, result.pagination); } catch (error) { return next(error); }
}

export async function exportReports(req, res, next) {
	try {
		const rows = await exportReportSummaries({ db: req.app.locals.prisma, actorUserId: req.user.id, ...req.query });
		res.type("text/csv").set("Content-Disposition", "attachment; filename=administrator-report-summaries.csv");
		return res.send(toCsv(["reference", "status", "department_code", "department_name", "course_unit_code", "course_unit_name", "academic_period_code", "academic_period_name", "lecturer_staff_number", "lecturer_name", "lecturer_email", "submitted_at", "created_at", "updated_at"], rows));
	} catch (error) { return next(error); }
}

export async function exportAuditLogRecords(req, res, next) {
	try {
		const rows = await exportAuditLogs({ db: req.app.locals.prisma, actorUserId: req.user.id, ...req.query });
		res.type("text/csv").set("Content-Disposition", "attachment; filename=administrator-audit-logs.csv");
		return res.send(toCsv(["id", "action", "entity_type", "entity_id", "actor_name", "actor_email", "created_at", "metadata"], rows));
	} catch (error) { return next(error); }
}

const handleList = (method, message) => async (req, res, next) => {
	try { const result = await academic[method]({ db: req.app.locals.prisma, ...req.query }); return sendSuccess(res, message, result.data, 200, result.pagination); } catch (error) { return next(error); }
};
const handleCreate = (method, message) => async (req, res, next) => {
	try { const result = await academic[method]({ db: req.app.locals.prisma, actorUserId: req.user.id, ...req.body }); return sendSuccess(res, message, result, 201); } catch (error) { return next(error); }
};
const handleUpdate = (method, message) => async (req, res, next) => {
	try { const result = await academic[method]({ db: req.app.locals.prisma, actorUserId: req.user.id, id: req.params.id, ...req.body }); return sendSuccess(res, message, result); } catch (error) { return next(error); }
};
const handleDelete = (method, message) => async (req, res, next) => {
	try { const result = await academic[method]({ db: req.app.locals.prisma, actorUserId: req.user.id, id: req.params.id }); return sendSuccess(res, message, result); } catch (error) { return next(error); }
};

export const getDepartments = handleList("listDepartments", "Departments retrieved successfully");
export const getDepartmentMembers = async (req, res, next) => {
	try { const result = await academic.listDepartmentMembers({ db: req.app.locals.prisma, departmentId: req.params.departmentId, ...req.query }); return sendSuccess(res, "Department members retrieved successfully", result.data, 200, result.pagination); } catch (error) { return next(error); }
};
export const createDepartment = handleCreate("createDepartment", "Department created successfully");
export const updateDepartment = handleUpdate("updateDepartment", "Department updated successfully");
export const getCourseUnits = handleList("listCourseUnits", "Course units retrieved successfully");
export const createCourseUnit = handleCreate("createCourseUnit", "Course unit created successfully");
export const updateCourseUnit = handleUpdate("updateCourseUnit", "Course unit updated successfully");
export const getAcademicPeriods = handleList("listAcademicPeriods", "Academic periods retrieved successfully");
export const createAcademicPeriod = handleCreate("createAcademicPeriod", "Academic period created successfully");
export const updateAcademicPeriod = handleUpdate("updateAcademicPeriod", "Academic period updated successfully");
export const getEnrollments = handleList("listEnrollments", "Enrolments retrieved successfully");
export const createEnrollment = handleCreate("createEnrollment", "Enrolment created successfully");
export const deleteEnrollment = handleDelete("deleteEnrollment", "Enrolment deleted successfully");
export const getMappings = handleList("listMappings", "Lecturer mappings retrieved successfully");
export const createMapping = handleCreate("createMapping", "Lecturer mapping created successfully");
export const deleteMapping = handleDelete("deleteMapping", "Lecturer mapping deleted successfully");
export const getClassrooms = handleList("listClassrooms", "Classrooms retrieved successfully");
export const createClassroom = handleCreate("createClassroom", "Classroom created successfully");
export const updateClassroom = handleUpdate("updateClassroom", "Classroom updated successfully");
export const getAssessments = handleList("listAssessments", "Assessments retrieved successfully");
export const createAssessment = handleCreate("createAssessment", "Assessment created successfully");
export const updateAssessment = handleUpdate("updateAssessment", "Assessment updated successfully");
export const getAssessmentTypes = handleList("listAssessmentTypes", "Assessment types retrieved successfully");
export const createAssessmentType = handleCreate("createAssessmentType", "Assessment type created successfully");
export const updateAssessmentType = handleUpdate("updateAssessmentType", "Assessment type updated successfully");
export const addDepartmentMember = async (req, res, next) => {
	try { const result = await academic.addDepartmentMember({ db: req.app.locals.prisma, actorUserId: req.user.id, departmentId: req.params.departmentId, ...req.body }); return sendSuccess(res, "Department member added successfully", result, 201); } catch (error) { return next(error); }
};
export const removeDepartmentMember = async (req, res, next) => {
	try { const result = await academic.removeDepartmentMember({ db: req.app.locals.prisma, actorUserId: req.user.id, departmentId: req.params.departmentId, userId: req.params.userId }); return sendSuccess(res, "Department member removed successfully", result); } catch (error) { return next(error); }
};