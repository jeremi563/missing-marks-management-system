import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
	createAssessment, createAssessmentType, createClassroom, createCourseUnit, createDepartment, createEnrollment, createMapping,
	createAcademicPeriod, deleteEnrollment, deleteMapping, getAssessmentTypes, getAssessments, getClassrooms, getCourseUnits,
	getDepartments, getDepartmentMembers, getEnrollments, getMappings, getAcademicPeriods, updateAssessment, updateAssessmentType, updateClassroom,
	updateCourseUnit, updateDepartment, updateAcademicPeriod, createUser, getUsers, updateUser,
	getAuditLogs, getReportSummaries, getSettings, patchSetting, exportAuditLogRecords, exportReports, getDashboard, reopenAdminReport, reassignAdminReport,
	addDepartmentMember, removeDepartmentMember, getUser,
  applyAttendanceCorrection,
} from "./admin.controller.js";
import { createUserBody, updateUserBody, userIdParams, userListQuery } from "./admin.validation.js";
import * as validation from "./academic.validation.js";
import * as operationsValidation from "./operations.validation.js";
import { attendanceCorrectionBodySchema } from "./attendance-correction.validation.js";

const router = Router();

router.use(authenticate, authorize("administrator"));
router.get("/users", validate(userListQuery, "query"), getUsers);
router.get("/users/:id", validate(userIdParams, "params"), getUser);
router.post("/users", validate(createUserBody), createUser);
router.patch("/users/:id", validate(userIdParams, "params"), validate(updateUserBody), updateUser);

router.get("/departments", validate(validation.departmentListQuery, "query"), getDepartments);
router.get("/departments/:departmentId/members", validate(validation.departmentOnlyParams, "params"), validate(validation.departmentMemberListQuery, "query"), getDepartmentMembers);
router.post("/departments/:departmentId/members", validate(validation.departmentOnlyParams, "params"), validate(validation.departmentMemberBody), addDepartmentMember);
router.delete("/departments/:departmentId/members/:userId", validate(validation.departmentMemberParams, "params"), removeDepartmentMember);
router.post("/departments", validate(validation.departmentCreateBody), createDepartment);
router.patch("/departments/:id", validate(validation.departmentIdParams, "params"), validate(validation.departmentUpdateBody), updateDepartment);
router.get("/course-units", validate(validation.courseUnitListQuery, "query"), getCourseUnits);
router.post("/course-units", validate(validation.courseUnitCreateBody), createCourseUnit);
router.patch("/course-units/:id", validate(validation.courseUnitIdParams, "params"), validate(validation.courseUnitUpdateBody), updateCourseUnit);
router.get("/academic-periods", validate(validation.academicPeriodListQuery, "query"), getAcademicPeriods);
router.post("/academic-periods", validate(validation.academicPeriodCreateBody), createAcademicPeriod);
router.patch("/academic-periods/:id", validate(validation.academicPeriodIdParams, "params"), validate(validation.academicPeriodUpdateBody), updateAcademicPeriod);
router.get("/enrolments", validate(validation.enrollmentListQuery, "query"), getEnrollments);
router.post("/enrolments", validate(validation.enrollmentCreateBody), createEnrollment);
router.delete("/enrolments/:id", validate(validation.enrollmentIdParams, "params"), deleteEnrollment);
router.get("/lecturer-mappings", validate(validation.mappingListQuery, "query"), getMappings);
router.post("/lecturer-mappings", validate(validation.mappingCreateBody), createMapping);
router.delete("/lecturer-mappings/:id", validate(validation.mappingIdParams, "params"), deleteMapping);
router.get("/classrooms", validate(validation.classroomListQuery, "query"), getClassrooms);
router.post("/classrooms", validate(validation.classroomCreateBody), createClassroom);
router.patch("/classrooms/:id", validate(validation.classroomIdParams, "params"), validate(validation.classroomUpdateBody), updateClassroom);
router.get("/assessments", validate(validation.assessmentListQuery, "query"), getAssessments);
router.post("/assessments", validate(validation.assessmentCreateBody), createAssessment);
router.patch("/assessments/:id", validate(validation.assessmentIdParams, "params"), validate(validation.assessmentUpdateBody), updateAssessment);
router.get("/assessment-types", validate(validation.assessmentTypeListQuery, "query"), getAssessmentTypes);
router.post("/assessment-types", validate(validation.assessmentTypeCreateBody), createAssessmentType);
router.patch("/assessment-types/:id", validate(validation.assessmentTypeIdParams, "params"), validate(validation.assessmentTypeUpdateBody), updateAssessmentType);
router.get("/settings", validate(operationsValidation.settingsQuery, "query"), getSettings);
router.patch("/settings/:key", validate(operationsValidation.settingKeyParams, "params"), validate(operationsValidation.settingUpdateBody), patchSetting);
router.get("/dashboard", getDashboard);
router.get("/reports", validate(operationsValidation.reportSummaryQuery, "query"), getReportSummaries);
router.get("/reports/export", validate(operationsValidation.reportExportQuery, "query"), exportReports);
router.get("/audit-logs", validate(operationsValidation.auditLogQuery, "query"), getAuditLogs);
router.get("/audit-logs/export", validate(operationsValidation.auditExportQuery, "query"), exportAuditLogRecords);
router.post("/reports/:reportId/reopen", validate(operationsValidation.maintenanceReportParams, "params"), validate(operationsValidation.reopenReportBody), reopenAdminReport);
router.post("/reports/:reportId/reassign", validate(operationsValidation.maintenanceReportParams, "params"), validate(operationsValidation.reassignReportBody), reassignAdminReport);
router.post("/attendance-corrections", validate(attendanceCorrectionBodySchema), applyAttendanceCorrection);

export default router;
