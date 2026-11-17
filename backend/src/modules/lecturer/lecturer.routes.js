import express from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import {
  getReports,
  getAssignedCourseUnits,
  getAssignedCourseUnitAssessments,
  getActiveClassrooms,
  getAssignedStudents,
  getReportById,
  getComments,
  addComment,
  submitDecision,
  escalateReportController,
  submitCorrection,
  createAttendanceSessionController,
  getAttendanceSessionsController,
  getAttendanceSessionByIdController,
  startAttendanceSessionController,
  generateAttendanceLinkController,
  extendAttendanceSessionController,
  endAttendanceSessionController,
  getAttendanceSessionRecordsController,
  getCatSubmissionsController,
  getCatSubmissionController,
  postCatSubmissionDecisionController,
  getLecturerExamAttendanceController,
  getLecturerExamAttendanceRecordController,
  postLecturerExamAttendanceDecisionController,
} from './lecturer.controller.js';
import { getAssessmentTypes, getLecturerCaseById, getLecturerCases, createLecturerCase, startReportWork } from '../feature5/feature5.controller.js';
import { createSpecialCaseBody, pageQuery, specialCaseIdParams } from '../feature5/feature5.validation.js';

import {
  reportIdSchema,
  createCommentSchema,
  submitDecisionSchema,
  escalateReportSchema,
  submitCorrectionSchema,
  createAttendanceSessionSchema,
  extendAttendanceSessionSchema,
  attendanceSessionIdSchema,
  courseUnitAssessmentsQuerySchema,
  courseUnitIdParamsSchema,
  lecturerStudentsQuerySchema,
  catSubmissionsQuerySchema,
  catSubmissionParamsSchema,
  catSubmissionDecisionSchema,
  examAttendanceQuerySchema,
  examAttendanceParamsSchema,
  examAttendanceDecisionSchema,
} from './lecturer.validation.js';
import { createLecturerDiscrepancy, getLecturerDiscrepancy, getLecturerDiscrepancies, reviewLecturerDiscrepancy, respondLecturerDiscrepancy } from './attendance-discrepancy.controller.js';
import { attendanceDiscrepancyListQuerySchema, attendanceDiscrepancyParamsSchema, createAttendanceDiscrepancySchema, reviewAttendanceDiscrepancySchema } from './lecturer.validation.js';
import { getEnrollmentRequestsForReviewer, postEnrollmentRequestDecision } from '../enrollment/enrollment-request.controller.js';
import { enrollmentRequestDecisionBody, enrollmentRequestListQuery } from '../enrollment/enrollment-request.validation.js';
import { getLecturerDepartments } from '../department-membership/department-membership.controller.js';
import { uploadEvidence } from '../../middleware/evidence-upload.js';
import { examBookletScanRateLimit } from '../exam-booklet/exam-booklet.rate-limit.js';
import {
  getExamBookletScanHistory,
  postExamBookletAllocations,
  postExamBookletManualLookup,
  postInvigilatorExamBookletPreview,
  postInvigilatorExamBookletScan,
  postLecturerExamBookletReplacement,
} from '../exam-booklet/exam-booklet.controller.js';
import {
  invigilatorBookletScanBody,
  invigilatorBookletPreviewBody,
  manualBookletLookupBody,
  replaceBookletBody,
  validateExamBookletHistoryQuery,
  validateExamBookletParams,
  validateExamBookletSessionParams,
} from '../exam-booklet/exam-booklet.validation.js';
import { getUserNotifications, patchAllUserNotificationsRead, patchUserNotificationRead } from '../../shared/controllers/user-notifications.controller.js';
import { userNotificationIdParams, userNotificationsQuery } from '../../shared/validation/user-notifications.validation.js';
import {
  getAssessmentRosterController,
  getLecturerMarkOptionsController,
  getLecturerReportCorrectionsController,
  postInitialMarksController,
} from '../marks/marks.controller.js';
import {
  assessmentMarkParams,
  assessmentRosterQuery,
  markOptionsQuery,
  reportCorrectionParams,
  submitMarksBody,
} from '../marks/marks.validation.js';
const router = express.Router();

router.get('/notifications', authenticate, authorize('lecturer'), validate(userNotificationsQuery, 'query'), getUserNotifications);
router.patch('/notifications/read-all', authenticate, authorize('lecturer'), patchAllUserNotificationsRead);
router.patch('/notifications/:notificationId/read', authenticate, authorize('lecturer'), validate(userNotificationIdParams, 'params'), patchUserNotificationRead);
router.get('/course-units', authenticate, authorize('lecturer'), getAssignedCourseUnits);
router.get('/cat-submissions', authenticate, authorize('lecturer'), validate(catSubmissionsQuerySchema, 'query'), getCatSubmissionsController);
router.get('/cat-submissions/:submissionId', authenticate, authorize('lecturer'), validate(catSubmissionParamsSchema, 'params'), getCatSubmissionController);
router.post('/cat-submissions/:submissionId/decision', authenticate, authorize('lecturer'), validate(catSubmissionParamsSchema, 'params'), validate(catSubmissionDecisionSchema, 'body'), postCatSubmissionDecisionController);
router.get('/exam-attendance', authenticate, authorize('lecturer'), validate(examAttendanceQuerySchema, 'query'), getLecturerExamAttendanceController);
router.get('/exam-attendance/:recordId', authenticate, authorize('lecturer'), validate(examAttendanceParamsSchema, 'params'), getLecturerExamAttendanceRecordController);
router.post('/exam-attendance/:recordId/decision', authenticate, authorize('lecturer'), validate(examAttendanceParamsSchema, 'params'), validate(examAttendanceDecisionSchema, 'body'), postLecturerExamAttendanceDecisionController);
router.post('/exam-booklets/sessions/:sessionId/allocate', authenticate, authorize('lecturer'), examBookletScanRateLimit, validateExamBookletSessionParams, postExamBookletAllocations);
router.post('/exam-booklets/sessions/:sessionId/scan/preview', authenticate, authorize('lecturer'), examBookletScanRateLimit, validateExamBookletSessionParams, validate(invigilatorBookletPreviewBody), postInvigilatorExamBookletPreview);
router.post('/exam-booklets/sessions/:sessionId/scan', authenticate, authorize('lecturer'), examBookletScanRateLimit, validateExamBookletSessionParams, validate(invigilatorBookletScanBody), postInvigilatorExamBookletScan);
router.post('/exam-booklets/sessions/:sessionId/manual-lookup', authenticate, authorize('lecturer'), examBookletScanRateLimit, validateExamBookletSessionParams, validate(manualBookletLookupBody), postExamBookletManualLookup);
router.get('/exam-booklets/sessions/:sessionId/scans', authenticate, authorize('lecturer'), validateExamBookletSessionParams, validateExamBookletHistoryQuery, getExamBookletScanHistory);
router.post('/exam-booklets/:bookletId/replacements', authenticate, authorize('lecturer'), examBookletScanRateLimit, validateExamBookletParams, validate(replaceBookletBody), postLecturerExamBookletReplacement);
router.get('/course-units/:courseUnitId/assessments', authenticate, authorize('lecturer'), validate(courseUnitIdParamsSchema, 'params'), validate(courseUnitAssessmentsQuerySchema, 'query'), getAssignedCourseUnitAssessments);
router.get('/marks/options', authenticate, authorize('lecturer'), validate(markOptionsQuery, 'query'), getLecturerMarkOptionsController);
router.get('/assessments/:assessmentId/marks', authenticate, authorize('lecturer'), validate(assessmentMarkParams, 'params'), validate(assessmentRosterQuery, 'query'), getAssessmentRosterController);
router.post('/assessments/:assessmentId/marks', authenticate, authorize('lecturer'), validate(assessmentMarkParams, 'params'), validate(submitMarksBody), postInitialMarksController);
router.get('/classrooms', authenticate, authorize('lecturer'), getActiveClassrooms);
router.get('/students', authenticate, authorize('lecturer'), validate(lecturerStudentsQuerySchema, 'query'), getAssignedStudents);
router.get('/enrollment-requests', authenticate, authorize('lecturer', 'cod'), validate(enrollmentRequestListQuery, 'query'), getEnrollmentRequestsForReviewer);
router.post('/enrollment-requests/decision', authenticate, authorize('lecturer', 'cod'), validate(enrollmentRequestDecisionBody), postEnrollmentRequestDecision);
router.get('/departments', authenticate, authorize('lecturer'), getLecturerDepartments);

router.post('/attendance-discrepancies', authenticate, authorize('lecturer'), validate(createAttendanceDiscrepancySchema), createLecturerDiscrepancy);
router.get('/attendance-discrepancies', authenticate, authorize('lecturer'), validate(attendanceDiscrepancyListQuerySchema, 'query'), getLecturerDiscrepancies);
router.get('/attendance-discrepancies/:id', authenticate, authorize('lecturer'), validate(attendanceDiscrepancyParamsSchema, 'params'), getLecturerDiscrepancy);
router.post('/attendance-discrepancies/:id/review', authenticate, authorize('lecturer'), validate(attendanceDiscrepancyParamsSchema, 'params'), validate(reviewAttendanceDiscrepancySchema), reviewLecturerDiscrepancy);
router.post('/attendance-discrepancies/:id/clarifications', authenticate, authorize('lecturer'), validate(attendanceDiscrepancyParamsSchema, 'params'), validate(createCommentSchema), respondLecturerDiscrepancy);

router.get('/assessment-types', authenticate, authorize('lecturer'), getAssessmentTypes);

// GET /api/v1/lecturer/reports
router.get(
  '/reports',
  authenticate,
  authorize('lecturer'),
  getReports
);

// GET /api/v1/lecturer/reports/:reportId
router.get(
  '/reports/:reportId',
  authenticate,
  authorize('lecturer'),
  validate(reportIdSchema, 'params'),
  getReportById
);

// GET /api/v1/lecturer/reports/:reportId/comments
router.get(
  '/reports/:reportId/comments',
  authenticate,
  authorize('lecturer'),
  validate(reportIdSchema, 'params'),
  getComments
);

// POST /api/v1/lecturer/reports/:reportId/comments
router.post(
  '/reports/:reportId/comments',
  authenticate,
  authorize('lecturer'),
  validate(reportIdSchema, 'params'),
  validate(createCommentSchema, 'body'),
  addComment
);

// POST /api/v1/lecturer/reports/:reportId/decision
router.post(
  '/reports/:reportId/decision',
  authenticate,
  authorize('lecturer'),
  validate(reportIdSchema, 'params'),
  validate(submitDecisionSchema, 'body'),
  submitDecision
);

router.post('/reports/:reportId/start', authenticate, authorize('lecturer'), validate(reportIdSchema, 'params'), startReportWork);
router.post('/reports/:reportId/special-cases', authenticate, authorize('lecturer'), validate(reportIdSchema, 'params'), uploadEvidence, validate(createSpecialCaseBody), createLecturerCase);
router.get('/special-cases/:caseId', authenticate, authorize('lecturer'), validate(specialCaseIdParams, 'params'), getLecturerCaseById);
router.get('/special-cases', authenticate, authorize('lecturer'), validate(pageQuery, 'query'), getLecturerCases);

// POST /api/v1/lecturer/reports/:reportId/escalate
router.post(
  '/reports/:reportId/escalate',
  authenticate,
  authorize('lecturer'),
  validate(reportIdSchema, 'params'),
  validate(escalateReportSchema, 'body'),
  escalateReportController
);
//feature 5: Mark-correction proposal submission

// POST /api/v1/lecturer/reports/:reportId/corrections
router.post(
  '/reports/:reportId/corrections',
  authenticate,
  authorize('lecturer'),
  validate(reportIdSchema, 'params'),
  validate(submitCorrectionSchema, 'body'),
  submitCorrection
);
router.get('/reports/:reportId/corrections', authenticate, authorize('lecturer'), validate(reportCorrectionParams, 'params'), getLecturerReportCorrectionsController);

// Feature 6: Retrieve lecturer attendance sessions
// GET /api/v1/lecturer/attendance/sessions
router.get(
  '/attendance/sessions',
  authenticate,
  authorize('lecturer'),
  getAttendanceSessionsController
);

// GET /api/v1/lecturer/attendance/sessions/:sessionId
router.get(
  '/attendance/sessions/:sessionId',
  authenticate,
  authorize('lecturer'),
  validate(attendanceSessionIdSchema, 'params'),
  getAttendanceSessionByIdController
);
// Feature 6: Unified attendance session creation
// POST /api/v1/lecturer/attendance/sessions
router.post(
  '/attendance/sessions',
  authenticate,
  authorize('lecturer'),
  validate(createAttendanceSessionSchema, 'body'),
  createAttendanceSessionController
);

// Start attendance session
router.post(
  '/attendance/sessions/:sessionId/start',
  authenticate,
  authorize('lecturer'),
  validate(attendanceSessionIdSchema, 'params'),
  startAttendanceSessionController
);

router.post(
  '/attendance/sessions/:sessionId/attendance-link',
  authenticate,
  authorize('lecturer'),
  validate(attendanceSessionIdSchema, 'params'),
  generateAttendanceLinkController
);

router.patch(
  '/attendance/sessions/:sessionId/end-time',
  authenticate,
  authorize('lecturer'),
  validate(attendanceSessionIdSchema, 'params'),
  validate(extendAttendanceSessionSchema),
  extendAttendanceSessionController
);

// End attendance session
router.post(
  '/attendance/sessions/:sessionId/end',
  authenticate,
  authorize('lecturer'),
  validate(attendanceSessionIdSchema, 'params'),
  endAttendanceSessionController
);

// Retrieve attendance records
router.get(
  '/attendance/sessions/:sessionId/records',
  authenticate,
  authorize('lecturer'),
  validate(attendanceSessionIdSchema, 'params'),
  getAttendanceSessionRecordsController
);
export default router;
