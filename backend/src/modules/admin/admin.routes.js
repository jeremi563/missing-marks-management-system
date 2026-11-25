import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
	createAssessment, createAssessmentType, createClassroom, createCourseUnit, createDepartment,
	createAcademicPeriod, deleteEnrollment, deleteMapping, getAssessmentTypes, getAssessments, getClassrooms, getCourseUnits,
	getDepartments, getDepartmentMembers, getEnrollments, getMappings, getAcademicPeriods, updateAssessment, updateAssessmentType, updateClassroom,
	updateCourseUnit, updateDepartment, updateAcademicPeriod, createUser, getUsers, updateUser,
	getAuditLogs, getReportSummaries, getSettings, patchSetting, exportAuditLogRecords, exportReports, getDashboard, reopenAdminReport, reassignAdminReport,
	addDepartmentMember, removeDepartmentMember, getUser, getPendingStaffAccounts, decideAccountApproval, importStudentRosterRecords, applyAttendanceCorrection,
	getCourses, createCourse,
	deleteStudent,
	saveAcademicYearSchedule,
} from "./admin.controller.js";
import { accountApprovalBody, createUserBody, rosterImportBody, updateUserBody, userIdParams, userListQuery } from "./admin.validation.js";
import * as validation from "./academic.validation.js";
import * as operationsValidation from "./operations.validation.js";
import { attendanceCorrectionBodySchema } from "./attendance-correction.validation.js";
import { resourceIntensiveRateLimit, sensitiveOperationRateLimit } from "../../middleware/rate-limit.js";

const router = Router();

router.use(authenticate, authorize("administrator"));
router.get("/pending-staff-accounts", getPendingStaffAccounts);
router.patch("/users/:id/approval", sensitiveOperationRateLimit, validate(userIdParams, "params"), validate(accountApprovalBody), decideAccountApproval);
router.post("/student-roster/import", resourceIntensiveRateLimit, sensitiveOperationRateLimit, validate(rosterImportBody), importStudentRosterRecords);
router.get("/users", validate(userListQuery, "query"), getUsers);
router.get("/users/:id", validate(userIdParams, "params"), getUser);
router.post("/users", sensitiveOperationRateLimit, validate(createUserBody), createUser);
router.patch("/users/:id", sensitiveOperationRateLimit, validate(userIdParams, "params"), validate(updateUserBody), updateUser);
router.delete("/users/:id", sensitiveOperationRateLimit, validate(userIdParams, "params"), deleteStudent);

router.get("/departments", validate(validation.departmentListQuery, "query"), getDepartments);
router.get("/departments/:departmentId/members", validate(validation.departmentOnlyParams, "params"), validate(validation.departmentMemberListQuery, "query"), getDepartmentMembers);
router.post("/departments/:departmentId/members", sensitiveOperationRateLimit, validate(validation.departmentOnlyParams, "params"), validate(validation.departmentMemberBody), addDepartmentMember);
router.delete("/departments/:departmentId/members/:userId", sensitiveOperationRateLimit, validate(validation.departmentMemberParams, "params"), removeDepartmentMember);
router.post("/departments", sensitiveOperationRateLimit, validate(validation.departmentCreateBody), createDepartment);
router.patch("/departments/:id", sensitiveOperationRateLimit, validate(validation.departmentIdParams, "params"), validate(validation.departmentUpdateBody), updateDepartment);
router.get("/courses", validate(validation.courseListQuery, "query"), getCourses);
router.post("/courses", sensitiveOperationRateLimit, validate(validation.courseCreateBody), createCourse);
router.get("/course-units", validate(validation.courseUnitListQuery, "query"), getCourseUnits);
router.post("/course-units", sensitiveOperationRateLimit, validate(validation.courseUnitCreateBody), createCourseUnit);
router.patch("/course-units/:id", sensitiveOperationRateLimit, validate(validation.courseUnitIdParams, "params"), validate(validation.courseUnitUpdateBody), updateCourseUnit);
router.get("/academic-periods", validate(validation.academicPeriodListQuery, "query"), getAcademicPeriods);
router.put("/academic-years/:academicYear/schedule", sensitiveOperationRateLimit, validate(validation.academicYearParams, "params"), validate(validation.academicYearScheduleBody), saveAcademicYearSchedule);
router.post("/academic-periods", sensitiveOperationRateLimit, validate(validation.academicPeriodCreateBody), createAcademicPeriod);
router.patch("/academic-periods/:id", sensitiveOperationRateLimit, validate(validation.academicPeriodIdParams, "params"), validate(validation.academicPeriodUpdateBody), updateAcademicPeriod);
router.get("/enrolments", validate(validation.enrollmentListQuery, "query"), getEnrollments);
router.delete("/enrolments/:id", sensitiveOperationRateLimit, validate(validation.enrollmentIdParams, "params"), deleteEnrollment);
router.get("/lecturer-mappings", validate(validation.mappingListQuery, "query"), getMappings);
router.delete("/lecturer-mappings/:id", sensitiveOperationRateLimit, validate(validation.mappingIdParams, "params"), deleteMapping);
router.get("/classrooms", validate(validation.classroomListQuery, "query"), getClassrooms);
router.post("/classrooms", sensitiveOperationRateLimit, validate(validation.classroomCreateBody), createClassroom);
router.patch("/classrooms/:id", sensitiveOperationRateLimit, validate(validation.classroomIdParams, "params"), validate(validation.classroomUpdateBody), updateClassroom);
router.get("/assessments", validate(validation.assessmentListQuery, "query"), getAssessments);
router.post("/assessments", sensitiveOperationRateLimit, validate(validation.assessmentCreateBody), createAssessment);
router.patch("/assessments/:id", sensitiveOperationRateLimit, validate(validation.assessmentIdParams, "params"), validate(validation.assessmentUpdateBody), updateAssessment);
router.get("/assessment-types", validate(validation.assessmentTypeListQuery, "query"), getAssessmentTypes);
router.post("/assessment-types", sensitiveOperationRateLimit, validate(validation.assessmentTypeCreateBody), createAssessmentType);
router.patch("/assessment-types/:id", sensitiveOperationRateLimit, validate(validation.assessmentTypeIdParams, "params"), validate(validation.assessmentTypeUpdateBody), updateAssessmentType);
router.get("/settings", validate(operationsValidation.settingsQuery, "query"), getSettings);
router.patch("/settings/:key", sensitiveOperationRateLimit, validate(operationsValidation.settingKeyParams, "params"), validate(operationsValidation.settingUpdateBody), patchSetting);
router.get("/dashboard", getDashboard);
router.get("/reports", resourceIntensiveRateLimit, validate(operationsValidation.reportSummaryQuery, "query"), getReportSummaries);
router.get("/reports/export", resourceIntensiveRateLimit, validate(operationsValidation.reportExportQuery, "query"), exportReports);
router.get("/audit-logs", resourceIntensiveRateLimit, validate(operationsValidation.auditLogQuery, "query"), getAuditLogs);
router.get("/audit-logs/export", resourceIntensiveRateLimit, validate(operationsValidation.auditExportQuery, "query"), exportAuditLogRecords);
router.post("/reports/:reportId/reopen", sensitiveOperationRateLimit, validate(operationsValidation.maintenanceReportParams, "params"), validate(operationsValidation.reopenReportBody), reopenAdminReport);
router.post("/reports/:reportId/reassign", sensitiveOperationRateLimit, validate(operationsValidation.maintenanceReportParams, "params"), validate(operationsValidation.reassignReportBody), reassignAdminReport);
router.post("/attendance-corrections", sensitiveOperationRateLimit, validate(attendanceCorrectionBodySchema), applyAttendanceCorrection);

export default router;
