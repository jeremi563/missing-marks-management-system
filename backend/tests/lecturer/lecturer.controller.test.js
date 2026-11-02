

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getReports,
  getReportById,
  getComments,
  addComment,
  submitDecision,
} from '../../src/modules/lecturer/lecturer.controller.js';

const createResponse = () => {
  const res = {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },
  };

  return res;
};

test('returns 401 when authentication is missing', async () => {
  const req = {
    user: null,
    app: { locals: {} },
    query: {},
  };

  const res = createResponse();

  await getReports(req, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('returns 500 when Prisma is not configured', async () => {
  const req = {
    user: { id: 'user-1' },
    app: { locals: {} },
    query: {},
  };

  const res = createResponse();

  await getReports(req, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});

test('returns assigned reports successfully', async () => {
  const reports = [
    { id: 'report-1', reference: 'MM-001' },
  ];

  const prisma = {
    lecturerProfile: {
      findUnique: async () => ({ id: 'lecturer-1' }),
    },

    missingMarkReport: {
      findMany: async () => reports,
      count: async () => 1,
    },

    $transaction: async (operations) => Promise.all(operations),
  };

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    query: {},
  };

  const res = createResponse();

  await getReports(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.pagination.total, 1);
});

test('passes service errors to the error handler', async () => {
  const expectedError = new Error('Database failure');

  const prisma = {
    lecturerProfile: {
      findUnique: async () => {
        throw expectedError;
      },
    },
  };

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    query: {},
  };

  const res = createResponse();
  let capturedError;

  await getReports(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError, expectedError);
});

//feature 2 :: individual missing mark report details
test('returns 401 when report details authentication is missing', async () => {
  const req = {
    user: null,
    app: { locals: {} },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();

  await getReportById(req, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('returns 500 when Prisma is unavailable for report details', async () => {
  const req = {
    user: { id: 'user-1' },
    app: { locals: {} },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();

  await getReportById(req, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});

test('returns report details successfully', async () => {
  const report = {
    id: 'report-1',
    reference: 'MM-001',
    student: { studentNumber: 'STU-001' },
  };

  const prisma = {
    lecturerProfile: {
      findUnique: async () => ({ id: 'lecturer-1' }),
    },

    missingMarkReport: {
      findFirst: async () => report,
    },
  };

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();

  await getReportById(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.reference, 'MM-001');
  assert.equal(res.body.data.student.studentNumber, 'STU-001');
});

test('passes report details service errors to the error handler', async () => {
  const expectedError = new Error('Database failure');

  const prisma = {
    lecturerProfile: {
      findUnique: async () => {
        throw expectedError;
      },
    },
  };

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();
  let capturedError;

  await getReportById(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError, expectedError);
});
// Feature 3: Report comments controller tests

const createCommentControllerPrisma = () => ({
  lecturerProfile: {
    findUnique: async () => ({ id: 'lecturer-1' }),
  },

  missingMarkReport: {
    findFirst: async () => ({ id: 'report-1' }),
  },

  reportComment: {
    findMany: async () => [
      {
        id: 'comment-1',
        body: 'Please clarify the missing mark.',
        createdAt: new Date('2026-11-02T08:00:00.000Z'),
        author: {
          id: 'user-1',
          displayName: 'Demo Lecturer',
          roles: [
  {
    role: {
      name: 'lecturer',
    },
  },
],
        },
      },
    ],

    create: async ({ data }) => ({
      id: 'comment-2',
      body: data.body,
      createdAt: new Date('2026-11-02T09:00:00.000Z'),
      author: {
        id: data.authorUserId,
        displayName: 'Demo Lecturer',
        roles: [
  {
    role: {
      name: 'lecturer',
    },
  },
],
      },
    }),
  },
});

test('returns 401 when comment retrieval authentication is missing', async () => {
  const req = {
    user: null,
    app: { locals: {} },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();

  await getComments(req, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test('returns 500 when Prisma is unavailable for comment retrieval', async () => {
  const req = {
    user: { id: 'user-1' },
    app: { locals: {} },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();

  await getComments(req, res, () => {});

  assert.equal(res.statusCode, 500);
});

test('retrieves report comments successfully', async () => {
  const prisma = createCommentControllerPrisma();

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();

  await getComments(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 1);
  assert.equal(
    res.body.data[0].body,
    'Please clarify the missing mark.'
  );
});

test('passes comment retrieval errors to the error handler', async () => {
  const expectedError = new Error('Database failure');

  const prisma = {
    lecturerProfile: {
      findUnique: async () => {
        throw expectedError;
      },
    },
  };

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
  };

  const res = createResponse();
  let capturedError;

  await getComments(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError, expectedError);
});

test('returns 401 when comment creation authentication is missing', async () => {
  const req = {
    user: null,
    app: { locals: {} },
    params: { reportId: 'report-1' },
    body: { body: 'Please clarify the missing mark.' },
  };

  const res = createResponse();

  await addComment(req, res, () => {});

  assert.equal(res.statusCode, 401);
});

test('returns 500 when Prisma is unavailable for comment creation', async () => {
  const req = {
    user: { id: 'user-1' },
    app: { locals: {} },
    params: { reportId: 'report-1' },
    body: { body: 'Please clarify the missing mark.' },
  };

  const res = createResponse();

  await addComment(req, res, () => {});

  assert.equal(res.statusCode, 500);
});

test('creates a report comment successfully', async () => {
  const prisma = createCommentControllerPrisma();

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
    body: { body: 'Please clarify the missing mark.' },
  };

  const res = createResponse();

  await addComment(req, res, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(
    res.body.data.body,
    'Please clarify the missing mark.'
  );
  assert.equal(res.body.data.author.id, 'user-1');
});

test('passes comment creation errors to the error handler', async () => {
  const expectedError = new Error('Database failure');

  const prisma = {
    lecturerProfile: {
      findUnique: async () => {
        throw expectedError;
      },
    },
  };

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
    body: { body: 'Please clarify the missing mark.' },
  };

  const res = createResponse();
  let capturedError;

  await addComment(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError, expectedError);
});

// Feature 4: Report decision controller tests

const createDecisionControllerPrisma = () => ({
  lecturerProfile: {
    findUnique: async () => ({ id: 'lecturer-1' }),
  },

  missingMarkReport: {
    findFirst: async () => ({
      id: 'report-1',
      reference: 'MM-001',
      status: 'pending',
    }),
  },

  $transaction: async (callback) =>
    callback({
      missingMarkReport: {
        updateMany: async () => ({ count: 1 }),
      },

      reportStatusHistory: {
        create: async ({ data }) => ({
          id: 'history-1',
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          reason: data.reason,
          createdAt: new Date(),
        }),
      },
    }),
});

test('returns 401 when decision authentication is missing', async () => {
  const req = {
    user: null,
    app: { locals: {} },
    params: { reportId: 'report-1' },
    body: { decision: 'APPROVE', reason: 'Verified.' },
  };

  const res = createResponse();

  await submitDecision(req, res, () => {});

  assert.equal(res.statusCode, 401);
});

test('returns 500 when Prisma is unavailable for a decision', async () => {
  const req = {
    user: { id: 'user-1' },
    app: { locals: {} },
    params: { reportId: 'report-1' },
    body: { decision: 'APPROVE', reason: 'Verified.' },
  };

  const res = createResponse();

  await submitDecision(req, res, () => {});

  assert.equal(res.statusCode, 500);
});

test('submits an approval decision successfully', async () => {
  const prisma = createDecisionControllerPrisma();

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
    body: {
      decision: 'APPROVE',
      reason: 'The submitted evidence has been verified.',
    },
  };

  const res = createResponse();

  await submitDecision(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.decision, 'APPROVE');
  assert.equal(res.body.data.status, 'APPROVED');
  assert.equal(res.body.data.history.reason,
    'The submitted evidence has been verified.');
});

test('passes decision submission errors to the error handler', async () => {
  const expectedError = new Error('Database failure');

  const prisma = {
    lecturerProfile: {
      findUnique: async () => {
        throw expectedError;
      },
    },
  };

  const req = {
    user: { id: 'user-1' },
    app: { locals: { prisma } },
    params: { reportId: 'report-1' },
    body: {
      decision: 'REJECT',
      reason: 'The evidence is insufficient.',
    },
  };

  const res = createResponse();
  let capturedError;

  await submitDecision(req, res, (error) => {
    capturedError = error;
  });

  assert.equal(capturedError, expectedError);
});