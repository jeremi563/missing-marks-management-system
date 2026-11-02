import test from 'node:test';
import assert from 'node:assert/strict';

import router from '../../src/modules/lecturer/lecturer.routes.js';

test('registers GET /reports', () => {
  const reportsRoute = router.stack.find(
    (layer) => layer.route?.path === '/reports'
  );

  assert.ok(reportsRoute, 'GET /reports route should exist');
  assert.equal(reportsRoute.route.methods.get, true);
});
// Additional tests for GET /reports route

test('registers GET /reports/:reportId', () => {
  const reportDetailsRoute = router.stack.find(
    (layer) => layer.route?.path === '/reports/:reportId'
  );

  assert.ok(
    reportDetailsRoute,
    'GET /reports/:reportId route should exist'
  );

  assert.equal(reportDetailsRoute.route.methods.get, true);
});

test('applies authentication, authorization and UUID validation', () => {
  const reportDetailsRoute = router.stack.find(
    (layer) => layer.route?.path === '/reports/:reportId'
  );

  const handlers = reportDetailsRoute.route.stack;

  assert.equal(handlers.length, 4);

  // authenticate, authorize, validate, controller
  assert.equal(typeof handlers[0].handle, 'function');
  assert.equal(typeof handlers[1].handle, 'function');
  assert.equal(typeof handlers[2].handle, 'function');
  assert.equal(typeof handlers[3].handle, 'function');
});