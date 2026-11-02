
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAssignedReports,
  getAssignedReportById,
  getReportComments,
  createReportComment,
  submitReportDecision,
  submitMarkCorrection,
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


// Feature 4: Lecturer report decision tests

const createDecisionPrisma = ({
  lecturer = { id: 'lecturer-1' },
  report = {
    id: 'report-1',
    reference: 'MM-001',
    status: 'pending',
  },
  updateCount = 1,
  historyFailure = null,
} = {}) => {
  const calls = {};

  const transaction = {
    missingMarkReport: {
      updateMany: async (args) => {
        calls.updateArgs = args;
        return { count: updateCount };
      },
    },

    reportStatusHistory: {
      create: async (args) => {
        calls.historyArgs = args;

        if (historyFailure) {
          throw historyFailure;
        }

        return {
          id: 'history-1',
          previousStatus: args.data.previousStatus,
          newStatus: args.data.newStatus,
          reason: args.data.reason,
          createdAt: new Date('2026-11-02T09:00:00.000Z'),
        };
      },
    },
  };

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

    $transaction: async (callback) => {
      calls.transactionStarted = true;
      return callback(transaction);
    },
  };

  return { prisma, calls };
};

test('approves a pending report and records audit history', async () => {
  const { prisma, calls } = createDecisionPrisma();

  const result = await submitReportDecision(
    prisma,
    'user-1',
    'report-1',
    'APPROVE',
    'The submitted evidence confirms the missing mark.'
  );

  assert.equal(result.status, 'APPROVED');
  assert.equal(result.decision, 'APPROVE');
  assert.equal(result.history.newStatus, 'APPROVED');
  assert.equal(result.history.previousStatus, 'pending');

  assert.deepEqual(calls.updateArgs.where, {
    id: 'report-1',
    assignedLecturerProfileId: 'lecturer-1',
    status: 'pending',
  });

  assert.deepEqual(calls.historyArgs.data, {
    reportId: 'report-1',
    actorUserId: 'user-1',
    previousStatus: 'pending',
    newStatus: 'APPROVED',
    reason: 'The submitted evidence confirms the missing mark.',
  });

  assert.equal(calls.transactionStarted, true);
});

test('rejects a pending report and records audit history', async () => {
  const { prisma } = createDecisionPrisma();

  const result = await submitReportDecision(
    prisma,
    'user-1',
    'report-1',
    'REJECT',
    'The submitted evidence is insufficient.'
  );

  assert.equal(result.status, 'REJECTED');
  assert.equal(result.decision, 'REJECT');
  assert.equal(result.history.newStatus, 'REJECTED');
});

test('supports uppercase pending report status', async () => {
  const { prisma } = createDecisionPrisma({
    report: {
      id: 'report-1',
      reference: 'MM-001',
      status: 'PENDING',
    },
  });

  const result = await submitReportDecision(
    prisma,
    'user-1',
    'report-1',
    'APPROVE',
    'Evidence verified.'
  );

  assert.equal(result.status, 'APPROVED');
});

test('rejects lecturers without profiles when submitting decisions', async () => {
  const { prisma, calls } = createDecisionPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => submitReportDecision(
      prisma,
      'user-2',
      'report-1',
      'APPROVE',
      'Evidence verified.'
    ),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.findFirstArgs, undefined);
});

test('rejects decisions for unassigned or nonexistent reports', async () => {
  const { prisma, calls } = createDecisionPrisma({
    report: null,
  });

  await assert.rejects(
    () => submitReportDecision(
      prisma,
      'user-1',
      'report-2',
      'APPROVE',
      'Evidence verified.'
    ),
    {
      message: 'Missing-mark report not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.transactionStarted, undefined);
});

test('rejects decisions on reports that are no longer pending', async () => {
  const { prisma, calls } = createDecisionPrisma({
    report: {
      id: 'report-1',
      reference: 'MM-001',
      status: 'APPROVED',
    },
  });

  await assert.rejects(
    () => submitReportDecision(
      prisma,
      'user-1',
      'report-1',
      'REJECT',
      'Change decision.'
    ),
    {
      statusCode: 409,
    }
  );

  assert.equal(calls.transactionStarted, undefined);
});

test('rejects concurrent decisions when the conditional update affects no row', async () => {
  const { prisma, calls } = createDecisionPrisma({
    updateCount: 0,
  });

  await assert.rejects(
    () => submitReportDecision(
      prisma,
      'user-1',
      'report-1',
      'APPROVE',
      'Evidence verified.'
    ),
    {
      statusCode: 409,
    }
  );

  assert.equal(calls.historyArgs, undefined);
});

test('does not complete the transaction when audit history creation fails', async () => {
  const { prisma } = createDecisionPrisma({
    historyFailure: new Error('Audit history failure'),
  });

  await assert.rejects(
    () => submitReportDecision(
      prisma,
      'user-1',
      'report-1',
      'APPROVE',
      'Evidence verified.'
    ),
    {
      message: 'Audit history failure',
    }
  );
});

// Feature 5: Mark-correction proposal test helper

const createCorrectionPrisma = ({
  lecturer = { id: 'lecturer-1' },
  report = {
    id: 'report-1',
    reference: 'MM-001',
    status: 'APPROVED',
    assessment: {
      maximumMarks: 100,
    },
  },
  existingCorrection = null,
  createFailure = null,
} = {}) => {
  const calls = {};

  const transaction = {
    markCorrection: {
      findFirst: async (args) => {
        calls.existingCorrectionArgs = args;
        return existingCorrection;
      },

      create: async (args) => {
        calls.correctionCreateArgs = args;

        if (createFailure) {
          throw createFailure;
        }

        return {
          id: 'correction-1',
          ...args.data,
          createdAt: new Date('2026-11-02T09:00:00.000Z'),
        };
      },
    },
  };

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

    $transaction: async (callback) => {
      calls.transactionStarted = true;
      return callback(transaction);
    },
  };

  return { prisma, calls };
};

// Feature 5: Mark-correction proposal tests

test('submits a correction proposal for an approved assigned report', async () => {
  const { prisma, calls } = createCorrectionPrisma();

  const result = await submitMarkCorrection(
    prisma,
    'user-1',
    'report-1',
    75.50,
    'The original mark was recorded incorrectly.'
  );

  assert.equal(result.reportId, 'report-1');
  assert.equal(result.reference, 'MM-001');
  assert.equal(result.correction.status, 'PENDING_REVIEW');
  assert.equal(result.correction.proposedValue, 75.50);

  assert.equal(
    calls.correctionCreateArgs.data.proposedByLecturerId,
    'lecturer-1'
  );

  assert.equal(calls.correctionCreateArgs.data.originalValue, null);
  assert.equal(calls.transactionStarted, true);
});

test('rejects correction proposals when the lecturer profile does not exist', async () => {
  const { prisma, calls } = createCorrectionPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => submitMarkCorrection(
      prisma,
      'user-2',
      'report-1',
      75,
      'Correction required.'
    ),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.findFirstArgs, undefined);
});

test('rejects correction proposals for unassigned or nonexistent reports', async () => {
  const { prisma, calls } = createCorrectionPrisma({
    report: null,
  });

  await assert.rejects(
    () => submitMarkCorrection(
      prisma,
      'user-1',
      'report-2',
      75,
      'Correction required.'
    ),
    {
      message: 'Missing-mark report not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.transactionStarted, undefined);
});

test('rejects correction proposals for reports that are not approved', async () => {
  const { prisma, calls } = createCorrectionPrisma({
    report: {
      id: 'report-1',
      reference: 'MM-001',
      status: 'PENDING',
      assessment: { maximumMarks: 100 },
    },
  });

  await assert.rejects(
    () => submitMarkCorrection(
      prisma,
      'user-1',
      'report-1',
      75,
      'Correction required.'
    ),
    {
      message: 'Mark corrections can only be proposed for approved reports.',
      statusCode: 409,
    }
  );

  assert.equal(calls.transactionStarted, undefined);
});

test('rejects proposals exceeding the assessment maximum mark', async () => {
  const { prisma, calls } = createCorrectionPrisma();

  await assert.rejects(
    () => submitMarkCorrection(
      prisma,
      'user-1',
      'report-1',
      105,
      'Correction required.'
    ),
    {
      message: 'Proposed mark cannot exceed the assessment maximum.',
      statusCode: 400,
    }
  );

  assert.equal(calls.transactionStarted, undefined);
});

test('rejects proposals when the assessment maximum mark is unavailable', async () => {
  const { prisma, calls } = createCorrectionPrisma({
    report: {
      id: 'report-1',
      reference: 'MM-001',
      status: 'APPROVED',
      assessment: { maximumMarks: null },
    },
  });

  await assert.rejects(
    () => submitMarkCorrection(
      prisma,
      'user-1',
      'report-1',
      75,
      'Correction required.'
    ),
    {
      message: 'The assessment maximum mark is unavailable.',
      statusCode: 422,
    }
  );

  assert.equal(calls.transactionStarted, undefined);
});

test('rejects a second outstanding correction proposal', async () => {
  const { prisma, calls } = createCorrectionPrisma({
    existingCorrection: { id: 'correction-existing' },
  });

  await assert.rejects(
    () => submitMarkCorrection(
      prisma,
      'user-1',
      'report-1',
      80,
      'Another correction required.'
    ),
    {
      message: 'An outstanding correction proposal already exists for this report.',
      statusCode: 409,
    }
  );

  assert.equal(calls.transactionStarted, true);
  assert.equal(calls.correctionCreateArgs, undefined);
});

test('allows a new proposal after the previous proposal was rejected', async () => {
  const { prisma, calls } = createCorrectionPrisma({
    existingCorrection: null,
  });

  const result = await submitMarkCorrection(
    prisma,
    'user-1',
    'report-1',
    85,
    'Submitting a revised correction proposal.'
  );

  assert.equal(result.correction.status, 'PENDING_REVIEW');
  assert.equal(calls.correctionCreateArgs.data.proposedValue, 85);
});

test('rejects negative and non-finite proposed marks', async () => {
  for (const proposedValue of [-1, NaN, Infinity, -Infinity]) {
    const { prisma } = createCorrectionPrisma();

    await assert.rejects(
      () => submitMarkCorrection(
        prisma,
        'user-1',
        'report-1',
        proposedValue,
        'Correction required.'
      ),
      {
        message: 'Invalid proposed mark.',
        statusCode: 400,
      }
    );
  }
});