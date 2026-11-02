
import test from 'node:test';
import assert from 'node:assert/strict';

import { getAssignedReports } from '../../src/modules/lecturer/lecturer.service.js';

const createMockPrisma = ({
  lecturer = { id: 'lecturer-1' },
  reports = [],
  total = reports.length,
} = {}) => {
  const calls = {};

  const prisma = {
    lecturerProfile: {
      findUnique: async () => lecturer,
    },

    missingMarkReport: {
      findMany: async (args) => {
        calls.findManyArgs = args;
        return reports;
      },

      count: async (args) => {
        calls.countArgs = args;
        return total;
      },
    },

    $transaction: async (operations) => Promise.all(operations),
  };

  return { prisma, calls };
};

test('retrieves reports assigned to the lecturer', async () => {
  const reports = [
    { id: 'report-1', reference: 'MM-001', status: 'PENDING' },
  ];

  const { prisma } = createMockPrisma({ reports });

  const result = await getAssignedReports(prisma, 'user-1');

  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].reference, 'MM-001');
});

test('returns pagination information', async () => {
  const { prisma, calls } = createMockPrisma({
    reports: [{ id: 'report-1' }],
    total: 25,
  });

  const result = await getAssignedReports(prisma, 'user-1', {
    page: '2',
    limit: '10',
  });

  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.limit, 10);
  assert.equal(result.pagination.total, 25);
  assert.equal(result.pagination.totalPages, 3);

  assert.equal(calls.findManyArgs.skip, 10);
  assert.equal(calls.findManyArgs.take, 10);
});

test('applies the requested status filter', async () => {
  const { prisma, calls } = createMockPrisma();

  await getAssignedReports(prisma, 'user-1', {
    status: 'PENDING',
  });

  assert.equal(calls.findManyArgs.where.status, 'PENDING');
  assert.equal(calls.countArgs.where.status, 'PENDING');
});

test('limits page size to a maximum of 100', async () => {
  const { prisma, calls } = createMockPrisma();

  const result = await getAssignedReports(prisma, 'user-1', {
    limit: '500',
  });

  assert.equal(result.pagination.limit, 100);
  assert.equal(calls.findManyArgs.take, 100);
});

test('rejects users without lecturer profiles', async () => {
  const { prisma } = createMockPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => getAssignedReports(prisma, 'user-2'),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );
});
