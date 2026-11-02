
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reportIdSchema,
  createCommentSchema,
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