
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAssignedReports,
  getAssignedReportById,
  getReportComments,
  createReportComment,
} from '../../src/modules/lecturer/lecturer.service.js';

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

// Test cases for feature 2 :: Retrieve individual missing mark report
const createReportDetailsPrisma = ({
  lecturer = { id: 'lecturer-1' },
  report = {
    id: 'report-1',
    reference: 'MM-001',
    status: 'PENDING',
    student: { studentNumber: 'STU-001' },
    courseUnit: { code: 'CSC101', name: 'Programming' },
    academicPeriod: { name: '2026 Semester 1' },
    assessment: { name: 'CAT 1', type: 'CAT' },
  },
} = {}) => {
  const calls = {};

  const prisma = {
    lecturerProfile: {
      findUnique: async () => lecturer,
    },

    missingMarkReport: {
      findFirst: async (args) => {
        calls.findFirstArgs = args;
        return report;
      },
    },
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
test('retrieves details of a report assigned to the lecturer', async () => {
  const { prisma, calls } = createReportDetailsPrisma();

  const result = await getAssignedReportById(
    prisma,
    'user-1',
    'report-1'
  );

  assert.equal(result.reference, 'MM-001');
  assert.equal(result.student.studentNumber, 'STU-001');
  assert.equal(result.courseUnit.code, 'CSC101');
  assert.equal(result.academicPeriod.name, '2026 Semester 1');
  assert.equal(result.assessment.name, 'CAT 1');

  assert.deepEqual(calls.findFirstArgs.where, {
    id: 'report-1',
    assignedLecturerProfileId: 'lecturer-1',
  });
});

test('returns 404 when report does not exist or is not assigned', async () => {
  const { prisma } = createReportDetailsPrisma({
    report: null,
  });

  await assert.rejects(
    () => getAssignedReportById(prisma, 'user-1', 'report-2'),
    {
      message: 'Missing-mark report not found.',
      statusCode: 404,
    }
  );
});

test('rejects users without lecturer profiles when retrieving report details', async () => {
  const { prisma } = createReportDetailsPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => getAssignedReportById(prisma, 'user-2', 'report-1'),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );
});

// Feature 3: Report investigation and comments

const createCommentPrisma = ({
  lecturer = { id: 'lecturer-1' },
  report = { id: 'report-1' },
  comments = [],
  createdComment = {
    id: 'comment-1',
    body: 'Please clarify the missing mark.',
    createdAt: new Date('2026-11-02T08:00:00.000Z'),
    author: {
      id: 'user-1',
      displayName: 'Demo Lecturer',
      roles: [
        { role: { name: 'lecturer' } },
      ],
    },
  },
} = {}) => {
  const calls = {};

  const prisma = {
    lecturerProfile: {
      findUnique: async () => lecturer,
    },

    missingMarkReport: {
      findFirst: async (args) => {
        calls.reportFindFirstArgs = args;
        return report;
      },
    },

    reportComment: {
      findMany: async (args) => {
        calls.commentFindManyArgs = args;
        return comments;
      },

      create: async (args) => {
        calls.commentCreateArgs = args;
        return createdComment;
      },
    },
  };

  return { prisma, calls };
};

test('retrieves comments for a report assigned to the lecturer', async () => {
  const comments = [
    {
      id: 'comment-1',
      body: 'First investigation comment.',
      createdAt: new Date('2026-11-02T08:00:00.000Z'),
      author: {
        id: 'user-1',
        displayName: 'Demo Lecturer',
        roles: [{ role: { name: 'lecturer' } }],
      },
    },
  ];

  const { prisma, calls } = createCommentPrisma({ comments });

  const result = await getReportComments(
    prisma,
    'user-1',
    'report-1'
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].body, 'First investigation comment.');
  assert.deepEqual(result[0].author.roles, ['lecturer']);

  assert.deepEqual(calls.reportFindFirstArgs.where, {
    id: 'report-1',
    assignedLecturerProfileId: 'lecturer-1',
  });
});

test('retrieves comments in chronological order', async () => {
  const { prisma, calls } = createCommentPrisma();

  await getReportComments(prisma, 'user-1', 'report-1');

  assert.deepEqual(calls.commentFindManyArgs.orderBy, {
    createdAt: 'asc',
  });
});

test('rejects lecturers without profiles when retrieving comments', async () => {
  const { prisma } = createCommentPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => getReportComments(prisma, 'user-2', 'report-1'),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );
});

test('rejects unassigned reports when retrieving comments', async () => {
  const { prisma } = createCommentPrisma({
    report: null,
  });

  await assert.rejects(
    () => getReportComments(prisma, 'user-1', 'report-2'),
    {
      message: 'Missing-mark report not found.',
      statusCode: 404,
    }
  );
});

test('creates a comment using the authenticated lecturer ID', async () => {
  const { prisma, calls } = createCommentPrisma();

  const result = await createReportComment(
    prisma,
    'user-1',
    'report-1',
    'Please clarify the missing mark.'
  );

  assert.equal(result.body, 'Please clarify the missing mark.');
  assert.equal(result.author.id, 'user-1');
  assert.deepEqual(result.author.roles, ['lecturer']);

  assert.deepEqual(calls.commentCreateArgs.data, {
    reportId: 'report-1',
    authorUserId: 'user-1',
    body: 'Please clarify the missing mark.',
  });
});

test('rejects comment creation for unassigned reports', async () => {
  const { prisma, calls } = createCommentPrisma({
    report: null,
  });

  await assert.rejects(
    () => createReportComment(
      prisma,
      'user-1',
      'report-2',
      'Please clarify the missing mark.'
    ),
    {
      message: 'Missing-mark report not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.commentCreateArgs, undefined);
});

test('rejects lecturers without profiles when creating comments', async () => {
  const { prisma, calls } = createCommentPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => createReportComment(
      prisma,
      'user-2',
      'report-1',
      'Please clarify the missing mark.'
    ),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.commentCreateArgs, undefined);
});