

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getReports,
  getReportById,
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