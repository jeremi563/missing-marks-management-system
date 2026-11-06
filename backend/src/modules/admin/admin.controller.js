import { sendSuccess } from "../../shared/utils/api-response.js";
import { createAdminUser, listAdminUsers, updateAdminUser } from "./admin.service.js";
import * as academic from "./academic.service.js";

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