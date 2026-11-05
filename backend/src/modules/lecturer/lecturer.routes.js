import express from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

import {
  getReports,
  getReportById,
  getComments,
  addComment,
  submitDecision,
  escalateReportController,
  submitCorrection,
  createAttendanceSessionController,
  getAttendanceSessionsController,
  getAttendanceSessionByIdController,
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
  attendanceSessionIdSchema
} from './lecturer.validation.js';

const router = express.Router();

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
router.post('/reports/:reportId/special-cases', authenticate, authorize('lecturer'), validate(reportIdSchema, 'params'), validate(createSpecialCaseBody), createLecturerCase);
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

export default router;
