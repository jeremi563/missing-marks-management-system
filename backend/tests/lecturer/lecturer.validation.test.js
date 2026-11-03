
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reportIdSchema,
  createCommentSchema,
  submitDecisionSchema,
  submitCorrectionSchema,
  createAttendanceSessionSchema,
  attendanceSessionIdSchema,
} from '../../src/modules/lecturer/lecturer.validation.js';

test('accepts a valid report UUID', () => {
  const result = reportIdSchema.safeParse({
    reportId: '550e8400-e29b-41d4-a716-446655440000',
  });

  assert.equal(result.success, true);
});

test('rejects an invalid report UUID', () => {
  const result = reportIdSchema.safeParse({
    reportId: 'invalid-report-id',
  });

  assert.equal(result.success, false);
});

test('rejects a missing report ID', () => {
  const result = reportIdSchema.safeParse({});

  assert.equal(result.success, false);
});

// Feature 3: Comment validation

test('accepts a valid comment', () => {
  const result = createCommentSchema.safeParse({
    body: 'Please clarify the missing mark.',
  });

  assert.equal(result.success, true);
});

test('trims whitespace around a comment', () => {
  const result = createCommentSchema.safeParse({
    body: '  Please clarify the missing mark.  ',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.body, 'Please clarify the missing mark.');
});

test('rejects an empty comment', () => {
  const result = createCommentSchema.safeParse({
    body: '',
  });

  assert.equal(result.success, false);
});

test('rejects a whitespace-only comment', () => {
  const result = createCommentSchema.safeParse({
    body: '   ',
  });

  assert.equal(result.success, false);
});

test('accepts a comment containing exactly 2000 characters', () => {
  const result = createCommentSchema.safeParse({
    body: 'a'.repeat(2000),
  });

  assert.equal(result.success, true);
});

test('rejects a comment exceeding 2000 characters', () => {
  const result = createCommentSchema.safeParse({
    body: 'a'.repeat(2001),
  });

  assert.equal(result.success, false);
});

test('rejects a missing comment body', () => {
  const result = createCommentSchema.safeParse({});

  assert.equal(result.success, false);
});

// Feature 4: Lecturer decision validation

test('accepts an APPROVE decision with a valid reason', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'APPROVE',
    reason: 'The submitted evidence has been verified.',
  });

  assert.equal(result.success, true);
});

test('accepts a REJECT decision with a valid reason', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'REJECT',
    reason: 'The submitted evidence is insufficient.',
  });

  assert.equal(result.success, true);
});

test('rejects an invalid decision value', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'PENDING',
    reason: 'Awaiting further review.',
  });

  assert.equal(result.success, false);
});

test('rejects a missing decision', () => {
  const result = submitDecisionSchema.safeParse({
    reason: 'A valid reason.',
  });

  assert.equal(result.success, false);
});

test('rejects a missing decision reason', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'APPROVE',
  });

  assert.equal(result.success, false);
});

test('rejects an empty decision reason', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'REJECT',
    reason: '',
  });

  assert.equal(result.success, false);
});

test('rejects a whitespace-only decision reason', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'REJECT',
    reason: '   ',
  });

  assert.equal(result.success, false);
});

test('trims whitespace around a decision reason', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'APPROVE',
    reason: '  Evidence verified.  ',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.reason, 'Evidence verified.');
});

test('accepts a decision reason containing exactly 2000 characters', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'APPROVE',
    reason: 'a'.repeat(2000),
  });

  assert.equal(result.success, true);
});

test('rejects a decision reason exceeding 2000 characters', () => {
  const result = submitDecisionSchema.safeParse({
    decision: 'APPROVE',
    reason: 'a'.repeat(2001),
  });

  assert.equal(result.success, false);
});
// Feature 5: Mark-correction proposal validation

test('accepts a valid mark-correction proposal', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75.50,
    reason: 'The original mark was recorded incorrectly.',
  });

  assert.equal(result.success, true);
});

test('accepts a whole-number proposed mark', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75,
    reason: 'Verified against the assessment records.',
  });

  assert.equal(result.success, true);
});

test('accepts a proposed mark with two decimal places', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75.25,
    reason: 'Verified correction.',
  });

  assert.equal(result.success, true);
});

test('rejects a negative proposed mark', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: -5,
    reason: 'Correction required.',
  });

  assert.equal(result.success, false);
});

test('rejects a proposed mark with more than two decimal places', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75.255,
    reason: 'Correction required.',
  });

  assert.equal(result.success, false);
});

test('rejects a non-numeric proposed mark', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: '75',
    reason: 'Correction required.',
  });

  assert.equal(result.success, false);
});

test('rejects a missing proposed mark', () => {
  const result = submitCorrectionSchema.safeParse({
    reason: 'Correction required.',
  });

  assert.equal(result.success, false);
});

test('rejects a missing correction reason', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75,
  });

  assert.equal(result.success, false);
});

test('rejects an empty correction reason', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75,
    reason: '',
  });

  assert.equal(result.success, false);
});

test('trims whitespace around a correction reason', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75,
    reason: '  Verified correction.  ',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.reason, 'Verified correction.');
});

test('rejects a correction reason exceeding 2000 characters', () => {
  const result = submitCorrectionSchema.safeParse({
    proposedValue: 75,
    reason: 'a'.repeat(2001),
  });

  assert.equal(result.success, false);
});

  // Feature 6: Unified attendance session validation

const validAttendanceSession = {
  sessionType: 'CLASS',
  courseUnitId: '550e8400-e29b-41d4-a716-446655440000',
  classroomId: '650e8400-e29b-41d4-a716-446655440000',
  startsAt: '2026-11-02T09:00:00+03:00',
};

test('accepts a valid CLASS attendance session', () => {
  const result = createAttendanceSessionSchema.safeParse(
    validAttendanceSession
  );

  assert.equal(result.success, true);
});

test('accepts a valid CAT attendance session', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    sessionType: 'CAT',
    assessmentId: '750e8400-e29b-41d4-a716-446655440000',
  });

  assert.equal(result.success, true);
});

test('accepts a valid EXAM attendance session', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    sessionType: 'EXAM',
    assessmentId: '850e8400-e29b-41d4-a716-446655440000',
  });

  assert.equal(result.success, true);
});

test('rejects a CLASS session with an assessment', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    assessmentId: '750e8400-e29b-41d4-a716-446655440000',
  });

  assert.equal(result.success, false);
});

test('rejects a CAT session without an assessment', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    sessionType: 'CAT',
  });

  assert.equal(result.success, false);
});

test('rejects an EXAM session without an assessment', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    sessionType: 'EXAM',
  });

  assert.equal(result.success, false);
});

test('rejects an invalid session type', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    sessionType: 'QUIZ',
  });

  assert.equal(result.success, false);
});

test('rejects a missing classroom ID', () => {
  const { classroomId, ...session } = validAttendanceSession;

  const result = createAttendanceSessionSchema.safeParse(session);

  assert.equal(result.success, false);
});

test('rejects an invalid course unit UUID', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    courseUnitId: 'invalid-id',
  });

  assert.equal(result.success, false);
});

test('rejects an end time before the start time', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    endsAt: '2026-11-02T08:00:00+03:00',
  });

  assert.equal(result.success, false);
});

test('rejects an end time equal to the start time', () => {
  const result = createAttendanceSessionSchema.safeParse({
    ...validAttendanceSession,
    endsAt: validAttendanceSession.startsAt,
  });

  assert.equal(result.success, false);
});

// Feature 6: Attendance session ID validation tests

test('accepts a valid attendance session UUID', () => {
  const result = attendanceSessionIdSchema.safeParse({
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
  });

  assert.equal(result.success, true);
});

test('rejects an invalid attendance session UUID', () => {
  const result = attendanceSessionIdSchema.safeParse({
    sessionId: 'invalid-session-id',
  });

  assert.equal(result.success, false);
});

test('rejects a missing attendance session ID', () => {
  const result = attendanceSessionIdSchema.safeParse({});

  assert.equal(result.success, false);
});