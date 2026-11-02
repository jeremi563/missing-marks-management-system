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