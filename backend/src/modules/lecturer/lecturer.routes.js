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
} from './lecturer.controller.js';

import {
  reportIdSchema,
  createCommentSchema,
  submitDecisionSchema,
} from './lecturer.validation.js';

const router = express.Router();

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

export default router;
