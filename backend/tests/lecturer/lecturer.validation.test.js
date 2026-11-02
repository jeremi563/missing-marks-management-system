
import test from 'node:test';
import assert from 'node:assert/strict';

import { reportIdSchema } from '../../src/modules/lecturer/lecturer.validation.js';

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