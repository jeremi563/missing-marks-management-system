import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters';

const { default: router } = await import('../../src/modules/lecturer/lecturer.routes.js');
const { lecturerStudentsQuerySchema } = await import('../../src/modules/lecturer/lecturer.validation.js');

test('registers GET /reports', () => {
  const reportsRoute = router.stack.find(
    (layer) => layer.route?.path === '/reports'
  );

  assert.ok(reportsRoute, 'GET /reports route should exist');
  assert.equal(reportsRoute.route.methods.get, true);
});

test('registers lecturer notification inbox and read actions behind lecturer authorization', () => {
  const inbox = router.stack.find((layer) => layer.route?.path === '/notifications' && layer.route.methods.get);
  const readAll = router.stack.find((layer) => layer.route?.path === '/notifications/read-all' && layer.route.methods.patch);
  const readOne = router.stack.find((layer) => layer.route?.path === '/notifications/:notificationId/read' && layer.route.methods.patch);

  assert.ok(inbox);
  assert.equal(inbox.route.stack.length, 4);
  assert.ok(readAll);
  assert.equal(readAll.route.stack.length, 3);
  assert.ok(readOne);
  assert.equal(readOne.route.stack.length, 4);
});

test('registers an authenticated lecturer attendance-link generation endpoint', () => {
  const route = router.stack.find(
    (layer) => layer.route?.path === '/attendance/sessions/:sessionId/attendance-link'
  );
  assert.ok(route);
  assert.equal(route.route.methods.post, true);
  assert.equal(route.route.stack.length, 4);
});

test('registers an authenticated end-time extension endpoint with body validation', () => {
  const route = router.stack.find(
    (layer) => layer.route?.path === '/attendance/sessions/:sessionId/end-time'
  );
  assert.ok(route);
  assert.equal(route.route.methods.patch, true);
  assert.equal(route.route.stack.length, 5);
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

test('registers lecturer enrollment-request inbox and bulk decisions', () => {
  const inboxRoute = router.stack.find(
    (layer) => layer.route?.path === '/enrollment-requests' && layer.route.methods.get
  );
  const decisionRoute = router.stack.find(
    (layer) => layer.route?.path === '/enrollment-requests/decision' && layer.route.methods.post
  );

  assert.ok(inboxRoute);
  assert.equal(inboxRoute.route.stack.length, 4);
  assert.ok(decisionRoute);
  assert.equal(decisionRoute.route.stack.length, 4);
});

test('exposes assigned departments for lecturer filters without a post-login membership request route', () => {
  const optionsRoute = router.stack.find((layer) => layer.route?.path === '/departments' && layer.route.methods.get);
  const requestRoute = router.stack.find((layer) => layer.route?.path === '/department-requests' && layer.route.methods.post);
  const studentsRoute = router.stack.find((layer) => layer.route?.path === '/students' && layer.route.methods.get);

  assert.ok(optionsRoute);
  assert.equal(optionsRoute.route.stack.length, 3);
  assert.equal(requestRoute, undefined);
  assert.ok(studentsRoute);
  assert.equal(studentsRoute.route.stack.length, 4);
});

test('validates lecturer student department filters as UUID lists', () => {
  const departmentId = '00000000-0000-4000-8000-000000000001';
  assert.deepEqual(lecturerStudentsQuerySchema.parse({ departmentIds: departmentId }).departmentIds, [departmentId]);
  assert.deepEqual(lecturerStudentsQuerySchema.parse({ departmentIds: '' }).departmentIds, []);
  assert.equal(lecturerStudentsQuerySchema.safeParse({ departmentIds: 'invalid' }).success, false);
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
// Feature 3: Report comments routes

test('registers GET /reports/:reportId/comments', () => {
  const commentsRoute = router.stack.find(
    (layer) => layer.route?.path === '/reports/:reportId/comments'
  );

  assert.ok(commentsRoute, 'GET comments route should exist');
  assert.equal(commentsRoute.route.methods.get, true);
});

test('registers POST /reports/:reportId/comments', () => {
  const commentsRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/reports/:reportId/comments' &&
      layer.route.methods.post
  );

  assert.ok(commentsRoute, 'POST comments route should exist');
  assert.equal(commentsRoute.route.methods.post, true);
});

test('applies authentication, authorization and UUID validation to GET comments', () => {
  const commentsRoute = router.stack.find(
    (layer) => layer.route?.path === '/reports/:reportId/comments'
      && layer.route.methods.get
  );

  const handlers = commentsRoute.route.stack;

  assert.equal(handlers.length, 4);
  assert.equal(typeof handlers[0].handle, 'function');
  assert.equal(typeof handlers[1].handle, 'function');
  assert.equal(typeof handlers[2].handle, 'function');
  assert.equal(typeof handlers[3].handle, 'function');
});

test('applies authentication, authorization, UUID validation and body validation to POST comments', () => {
  const commentsRoute = router.stack.find(
    (layer) => layer.route?.path === '/reports/:reportId/comments'
      && layer.route.methods.post
  );

  const handlers = commentsRoute.route.stack;

  assert.equal(handlers.length, 5);
  assert.equal(typeof handlers[0].handle, 'function');
  assert.equal(typeof handlers[1].handle, 'function');
  assert.equal(typeof handlers[2].handle, 'function');
  assert.equal(typeof handlers[3].handle, 'function');
  assert.equal(typeof handlers[4].handle, 'function');
});

// Feature 4: Report decision routes

test('registers POST /reports/:reportId/decision', () => {
  const decisionRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/reports/:reportId/decision' &&
      layer.route.methods.post
  );

  assert.ok(
    decisionRoute,
    'POST decision route should exist'
  );

  assert.equal(decisionRoute.route.methods.post, true);
});

test('applies authentication, authorization, UUID validation and decision body validation', () => {
  const decisionRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/reports/:reportId/decision' &&
      layer.route.methods.post
  );

  assert.ok(decisionRoute);

  const handlers = decisionRoute.route.stack;

  // authenticate, authorize, validate params,
  // validate body, controller
  assert.equal(handlers.length, 5);

  for (const handler of handlers) {
    assert.equal(typeof handler.handle, 'function');
  }
});

test('registers POST /reports/:reportId/escalate with authentication, lecturer role and validations', () => {
  const route = router.stack.find((layer) =>
    layer.route?.path === '/reports/:reportId/escalate' && layer.route.methods.post
  );
  assert.ok(route);
  assert.equal(route.route.stack.length, 5);
  for (const handler of route.route.stack) assert.equal(typeof handler.handle, 'function');
});

test('escalation route rejects unauthenticated and non-lecturer users', async () => {
  const route = router.stack.find((layer) => layer.route?.path === '/reports/:reportId/escalate');
  let unauthenticatedError;
  await route.route.stack[0].handle({ get: () => undefined, cookies: {} }, {}, (error) => { unauthenticatedError = error; });
  assert.equal(unauthenticatedError.statusCode, 401);

  let roleError;
  route.route.stack[1].handle({ user: { roles: ['student'] } }, {}, (error) => { roleError = error; });
  assert.equal(roleError.statusCode, 403);
});

// Feature 5: Mark-correction proposal route tests

test('registers POST /reports/:reportId/corrections', () => {
  const correctionRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/reports/:reportId/corrections' &&
      layer.route.methods.post
  );

  assert.ok(
    correctionRoute,
    'POST correction route should exist'
  );

  assert.equal(correctionRoute.route.methods.post, true);
});

test('applies authentication, authorization, UUID validation and correction body validation', () => {
  const correctionRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/reports/:reportId/corrections' &&
      layer.route.methods.post
  );

  assert.ok(correctionRoute);

  const handlers = correctionRoute.route.stack;

  // authenticate, authorize, validate params,
  // validate body, controller
  assert.equal(handlers.length, 5);

  for (const handler of handlers) {
    assert.equal(typeof handler.handle, 'function');
  }
});

// Feature 6: Unified attendance session route tests

test('registers POST /attendance/sessions', () => {
  const attendanceRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/attendance/sessions' &&
      layer.route.methods.post
  );

  assert.ok(
    attendanceRoute,
    'POST /attendance/sessions route should exist'
  );

  assert.equal(attendanceRoute.route.methods.post, true);
});

test('applies authentication, authorization and attendance body validation', () => {
  const attendanceRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/attendance/sessions' &&
      layer.route.methods.post
  );

  assert.ok(attendanceRoute);

  const handlers = attendanceRoute.route.stack;

  // authenticate, authorize, validate body, controller
  assert.equal(handlers.length, 4);

  for (const handler of handlers) {
    assert.equal(typeof handler.handle, 'function');
  }
});

test('registers GET /attendance/sessions', () => {
  const attendanceRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/attendance/sessions' &&
      layer.route.methods.get
  );

  assert.ok(
    attendanceRoute,
    'GET /attendance/sessions route should exist'
  );

  assert.equal(attendanceRoute.route.methods.get, true);
});

test('applies authentication and authorization to GET attendance sessions', () => {
  const attendanceRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/attendance/sessions' &&
      layer.route.methods.get
  );

  assert.ok(attendanceRoute);

  const handlers = attendanceRoute.route.stack;

  // authenticate, authorize, controller
  assert.equal(handlers.length, 3);

  for (const handler of handlers) {
    assert.equal(typeof handler.handle, 'function');
  }
});

// Feature 6: Individual attendance session retrieval route tests

test('registers GET /attendance/sessions/:sessionId', () => {
  const sessionRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/attendance/sessions/:sessionId'
  );

  assert.ok(
    sessionRoute,
    'GET /attendance/sessions/:sessionId route should exist'
  );

  assert.equal(sessionRoute.route.methods.get, true);
});

test('applies authentication, authorization and UUID validation to individual attendance retrieval', () => {
  const sessionRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/attendance/sessions/:sessionId'
  );

  assert.ok(sessionRoute);

  const handlers = sessionRoute.route.stack;

  assert.equal(handlers.length, 4);
});

test('registers POST start and end attendance session routes', () => {
  for (const action of ['start', 'end']) {
    const route = router.stack.find(
      (layer) =>
        layer.route?.path === `/attendance/sessions/:sessionId/${action}`
    );

    assert.ok(route, `POST ${action} attendance route should exist`);
    assert.equal(route.route.methods.post, true);
    assert.equal(route.route.methods.patch, undefined);
    assert.equal(route.route.stack.length, 4);
  }
});

test('registers GET attendance records with authentication, lecturer role and UUID validation', () => {
  const recordsRoute = router.stack.find(
    (layer) =>
      layer.route?.path === '/attendance/sessions/:sessionId/records'
  );

  assert.ok(recordsRoute, 'GET attendance records route should exist');
  assert.equal(recordsRoute.route.methods.get, true);
  assert.equal(recordsRoute.route.stack.length, 4);
});
