
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters';

const {
  getAssignedReports,
  getAssignedReportById,
  getReportComments,
  createReportComment,
  submitReportDecision,
  escalateAssignedReport,
  submitMarkCorrection,
  createAttendanceSession,
  getAttendanceSessions,
  getAttendanceSessionById,
} = await import('../../src/modules/lecturer/lecturer.service.js');

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
    isStudentVisible: false,
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
    reportAssignment: {
      findFirst: async () => ({ id: 'assignment-1', workStartedAt: new Date('2026-11-02T08:00:00.000Z') }),
    },
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
    auditLog: { create: async () => ({ id: 'audit-1' }) },
  };

  const prisma = {
    assessmentType: {
      findFirst: async () => ({ id: 'type-cat', code: 'CAT', name: 'CAT' }),
    },
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

// Feature 4: Lecturer escalation tests
const createEscalationPrisma = ({
  lecturer = { id: 'lecturer-1' },
  report = { id: 'report-1', reference: 'MM-001', status: 'APPROVED' },
  updateCount = 1,
  historyFailure = null,
  auditFailure = null,
  priorEscalation = null,
} = {}) => {
  const calls = {};
  let persistedStatus = report?.status ?? null;
  const transaction = {
    missingMarkReport: {
      updateMany: async (args) => {
        calls.updateArgs = args;
        if (updateCount === 1) persistedStatus = args.data.status;
        return { count: updateCount };
      },
    },
    reportStatusHistory: {
      create: async (args) => {
        calls.historyArgs = args;
        if (historyFailure) throw historyFailure;
        return { id: 'history-2', ...args.data, createdAt: new Date('2026-11-03T09:00:00.000Z') };
      },
    },
    auditLog: {
      create: async (args) => {
        calls.auditArgs = args;
        if (auditFailure) throw auditFailure;
        return { id: 'audit-1', ...args.data };
      },
    },
  };
  const prisma = {
    lecturerProfile: { findUnique: async () => lecturer },
    missingMarkReport: { findFirst: async (args) => { calls.findFirstArgs = args; return report; } },
    reportStatusHistory: { findFirst: async (args) => { calls.priorEscalationArgs = args; return priorEscalation; } },
    $transaction: async (callback) => {
      calls.transactionStarted = true;
      const startingStatus = persistedStatus;
      try {
        const result = await callback(transaction);
        calls.persistedStatus = persistedStatus;
        return result;
      } catch (error) {
        persistedStatus = startingStatus;
        calls.persistedStatus = persistedStatus;
        throw error;
      }
    },
  };
  return { prisma, calls };
};

for (const decision of ['APPROVED', 'REJECTED']) {
  test(`assigned lecturer escalates an existing ${decision} decision`, async () => {
    const { prisma, calls } = createEscalationPrisma({
      report: { id: 'report-1', reference: 'MM-001', status: decision },
    });
    const result = await escalateAssignedReport(prisma, 'user-1', 'report-1', 'Needs COD review.');

    assert.equal(result.lecturerDecision, decision);
    assert.equal(result.status, 'ESCALATED');
    assert.deepEqual(calls.updateArgs.where, {
      id: 'report-1', assignedLecturerProfileId: 'lecturer-1', status: decision,
    });
    assert.deepEqual(calls.historyArgs.data, {
      reportId: 'report-1', actorUserId: 'user-1', previousStatus: decision,
      newStatus: 'ESCALATED', reason: 'Needs COD review.',
    });
    assert.equal(calls.auditArgs.data.actorId, 'user-1');
    assert.equal(calls.auditArgs.data.action, 'REPORT_ESCALATED');
  });
}

test('does not escalate an unassigned or missing report', async () => {
  const { prisma, calls } = createEscalationPrisma({ report: null });
  await assert.rejects(() => escalateAssignedReport(prisma, 'user-1', 'report-1', 'Review.'), { statusCode: 404 });
  assert.equal(calls.transactionStarted, undefined);
});

test('does not escalate a report without an approved or rejected lecturer decision', async () => {
  const { prisma, calls } = createEscalationPrisma({ report: { id: 'report-1', status: 'PENDING' } });
  await assert.rejects(() => escalateAssignedReport(prisma, 'user-1', 'report-1', 'Review.'), { statusCode: 409 });
  assert.equal(calls.transactionStarted, undefined);
});

test('rejects a report that has already been escalated before a later final decision', async () => {
  const { prisma, calls } = createEscalationPrisma({ priorEscalation: { id: 'history-escalation' } });
  await assert.rejects(() => escalateAssignedReport(prisma, 'user-1', 'report-1', 'Review.'), { statusCode: 409 });
  assert.deepEqual(calls.priorEscalationArgs.where, { reportId: 'report-1', newStatus: 'ESCALATED' });
  assert.equal(calls.transactionStarted, undefined);
});

test('rejects repeated or concurrent escalation when the conditional update affects no row', async () => {
  const { prisma, calls } = createEscalationPrisma({ updateCount: 0 });
  await assert.rejects(() => escalateAssignedReport(prisma, 'user-1', 'report-1', 'Review.'), { statusCode: 409 });
  assert.equal(calls.historyArgs, undefined);
  assert.equal(calls.auditArgs, undefined);
});

test('does not complete escalation when status-history creation fails', async () => {
  const { prisma, calls } = createEscalationPrisma({ historyFailure: new Error('History insert failed') });
  await assert.rejects(() => escalateAssignedReport(prisma, 'user-1', 'report-1', 'Review.'), { message: 'History insert failed' });
  assert.equal(calls.auditArgs, undefined);
  assert.equal(calls.persistedStatus, 'APPROVED');
});

test('does not complete escalation when audit creation fails', async () => {
  const { prisma, calls } = createEscalationPrisma({ auditFailure: new Error('Audit insert failed') });
  await assert.rejects(() => escalateAssignedReport(prisma, 'user-1', 'report-1', 'Review.'), { message: 'Audit insert failed' });
  assert.equal(calls.historyArgs.data.newStatus, 'ESCALATED');
  assert.equal(calls.auditArgs.data.actorId, 'user-1');
  assert.equal(calls.persistedStatus, 'APPROVED');
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


const createAttendancePrisma = ({
  lecturer = { id: 'lecturer-1' },
  assignment = { id: 'assignment-1' },
  classroom = { id: 'classroom-1' },
  assessment = { id: 'assessment-1' },
  createdSession = {
    id: 'session-1',
    status: 'scheduled',
  },
} = {}) => {
  const calls = {};

  const prisma = {
    lecturerProfile: {
      findUnique: async () => lecturer,
    },

    courseUnitLecturer: {
      findUnique: async (args) => {
        calls.assignmentArgs = args;
        return assignment;
      },
    },

    classroom: {
      findFirst: async (args) => {
        calls.classroomArgs = args;
        return classroom;
      },
    },

    assessment: {
      findFirst: async (args) => {
        calls.assessmentArgs = args;
        return assessment;
      },
    },

    attendanceSession: {
      create: async (args) => {
        calls.sessionCreateArgs = args;
        return createdSession;
      },
    },
  };

  return { prisma, calls };
};


const validClassSession = {
  sessionType: 'CLASS',
  courseUnitId: '550e8400-e29b-41d4-a716-446655440000',
  classroomId: '650e8400-e29b-41d4-a716-446655440000',
  startsAt: '2026-11-02T09:00:00+03:00',
};

test('creates a CLASS attendance session without an assessment', async () => {
  const { prisma, calls } = createAttendancePrisma();

  const result = await createAttendanceSession(
    prisma,
    'user-1',
    validClassSession
  );

  assert.equal(result.session.id, 'session-1');
  assert.equal(typeof result.qrToken, 'string');
  assert.equal(result.qrToken.length, 64);
  assert.equal(calls.sessionCreateArgs.data.assessmentId, null);
  assert.equal(calls.sessionCreateArgs.data.sessionType, 'CLASS');
  assert.equal(
    calls.sessionCreateArgs.data.accessTokenHash.length,
    64
  );
  assert.notEqual(
    calls.sessionCreateArgs.data.accessTokenHash,
    result.qrToken
  );
  assert.equal(calls.assessmentArgs, undefined);
});

test('creates a CAT attendance session using a registered CAT assessment', async () => {
  const { prisma, calls } = createAttendancePrisma({
    assessment: { id: 'assessment-1' },

  });
  const result = await createAttendanceSession(
    prisma,
    'user-1',
    {
      ...validClassSession,
      sessionType: 'CAT',
      assessmentId: 'assessment-1',

    }
  );
  assert.equal(result.session.id, 'session-1');
  assert.equal(
    calls.assessmentArgs.where.type,
    'CAT'
  );
  assert.equal(
    calls.sessionCreateArgs.data.assessmentId,
    'assessment-1'
  );
  assert.equal(calls.sessionCreateArgs.data.sessionType, 'CAT');
});

test('creates an EXAM attendance session using a registered EXAM assessment', async () => {
  const { prisma, calls } = createAttendancePrisma({
    assessment: { id: 'assessment-1' },
  });

  const result = await createAttendanceSession(
    prisma,
    'user-1',
    {
      ...validClassSession,
      sessionType: 'EXAM',
      assessmentId: 'assessment-1',
    }
  );

  assert.equal(result.session.id, 'session-1');
  assert.equal(
    calls.assessmentArgs.where.type,
    'EXAM'
  );
  assert.equal(
    calls.sessionCreateArgs.data.assessmentId,
    'assessment-1'
  );
  assert.equal(calls.sessionCreateArgs.data.sessionType, 'EXAM');
});


test('rejects attendance session creation when lecturer profile is missing', async () => {
  const { prisma, calls } = createAttendancePrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => createAttendanceSession(
      prisma,
      'user-1',
      validClassSession
    ),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.assignmentArgs, undefined);
  assert.equal(calls.sessionCreateArgs, undefined);
});

test('rejects attendance session creation when lecturer is not assigned to course unit', async () => {
  const { prisma, calls } = createAttendancePrisma({
    assignment: null,
  });

  await assert.rejects(
    () => createAttendanceSession(
      prisma,
      'user-1',
      validClassSession
    ),
    {
      message: 'You are not assigned to this course unit.',
      statusCode: 403,
    }
  );

  assert.equal(calls.classroomArgs, undefined);
  assert.equal(calls.sessionCreateArgs, undefined);
});

test('rejects attendance session creation when classroom is inactive or missing', async () => {
  const { prisma, calls } = createAttendancePrisma({
    classroom: null,
  });

  await assert.rejects(
    () => createAttendanceSession(
      prisma,
      'user-1',
      validClassSession
    ),
    {
      message: 'Active classroom not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.sessionCreateArgs, undefined);
});

test('rejects CAT session when its assessment is missing or mismatched', async () => {
  const { prisma, calls } = createAttendancePrisma({
    assessment: null,
  });

  await assert.rejects(
    () => createAttendanceSession(
      prisma,
      'user-1',
      {
        ...validClassSession,
        sessionType: 'CAT',
        assessmentId: 'assessment-1',
      }
    ),
    {
      message:
        'The assessment must exist, belong to the selected course unit, and match the session type.',
      statusCode: 422,
    }
  );

  assert.equal(calls.sessionCreateArgs, undefined);
});

test('rejects EXAM session when its assessment is missing or mismatched', async () => {
  const { prisma, calls } = createAttendancePrisma({
    assessment: null,
  });

  await assert.rejects(
    () => createAttendanceSession(
      prisma,
      'user-1',
      {
        ...validClassSession,
        sessionType: 'EXAM',
        assessmentId: 'assessment-1',
      }
    ),
    {
      message:
        'The assessment must exist, belong to the selected course unit, and match the session type.',
      statusCode: 422,
    }
  );

  assert.equal(calls.sessionCreateArgs, undefined);
});

test('rejects CLASS session when an assessment is supplied', async () => {
  const { prisma, calls } = createAttendancePrisma();

  await assert.rejects(
    () => createAttendanceSession(
      prisma,
      'user-1',
      {
        ...validClassSession,
        assessmentId: 'assessment-1',
      }
    ),
    {
      message: 'CLASS sessions must not reference an assessment.',
      statusCode: 400,
    }
  );

  assert.equal(calls.sessionCreateArgs, undefined);
});

// Mock Prisma client for attendance session listing tests
const createAttendanceListingPrisma = ({
  lecturer = { id: 'lecturer-1' },
  sessions = [],
  total = 0,
} = {}) => {
  const calls = {};

  const prisma = {
    lecturerProfile: {
      findUnique: async () => lecturer,
    },

    attendanceSession: {
      findMany: async (args) => {
        calls.findManyArgs = args;
        return sessions;
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

test('filters attendance sessions by CLASS session type', async () => {
  const { prisma, calls } = createAttendanceListingPrisma();

  await getAttendanceSessions(prisma, 'user-1', {
    sessionType: 'CLASS',
  });

  assert.equal(
    calls.findManyArgs.where.sessionType,
    'CLASS'
  );

  assert.equal(
    calls.findManyArgs.where.lecturerProfileId,
    'lecturer-1'
  );
});

test('filters attendance sessions by CAT session type', async () => {
  const { prisma, calls } = createAttendanceListingPrisma();

  await getAttendanceSessions(prisma, 'user-1', {
    sessionType: 'CAT',
  });

  assert.equal(
    calls.findManyArgs.where.sessionType,
    'CAT'
  );
});

test('filters attendance sessions by EXAM session type', async () => {
  const { prisma, calls } = createAttendanceListingPrisma();

  await getAttendanceSessions(prisma, 'user-1', {
    sessionType: 'EXAM',
  });

  assert.equal(
    calls.findManyArgs.where.sessionType,
    'EXAM'
  );
});

test('paginates attendance sessions correctly', async () => {
  const sessions = [
    { id: 'session-1' },
    { id: 'session-2' },
  ];

  const { prisma, calls } = createAttendanceListingPrisma({
    sessions,
    total: 12,
  });

  const result = await getAttendanceSessions(prisma, 'user-1', {
    page: '2',
    limit: '5',
  });

  assert.equal(calls.findManyArgs.skip, 5);
  assert.equal(calls.findManyArgs.take, 5);

  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.limit, 5);
  assert.equal(result.pagination.total, 12);
  assert.equal(result.pagination.totalPages, 3);

  assert.deepEqual(result.sessions, sessions);
});

test('rejects attendance session listing when lecturer profile is missing', async () => {
  const { prisma, calls } = createAttendanceListingPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => getAttendanceSessions(prisma, 'user-1'),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.findManyArgs, undefined);
});

// Feature 6: Individual attendance session retrieval tests

const createAttendanceDetailPrisma = ({
  lecturer = { id: 'lecturer-1' },
  session = { id: 'session-1', sessionType: 'CLASS' },
} = {}) => {
  const calls = {};

  const prisma = {
    lecturerProfile: {
      findUnique: async (args) => {
        calls.lecturerArgs = args;
        return lecturer;
      },
    },

    attendanceSession: {
      findFirst: async (args) => {
        calls.sessionArgs = args;
        return session;
      },
    },
  };

  return { prisma, calls };
};

test('retrieves an attendance session belonging to the lecturer', async () => {
  const session = {
    id: 'session-1',
    sessionType: 'CLASS',
    status: 'scheduled',
  };

  const { prisma, calls } = createAttendanceDetailPrisma({
    session,
  });

  const result = await getAttendanceSessionById(
    prisma,
    'user-1',
    'session-1'
  );

  assert.deepEqual(result, session);

  assert.equal(
    calls.sessionArgs.where.id,
    'session-1'
  );

  assert.equal(
    calls.sessionArgs.where.lecturerProfileId,
    'lecturer-1'
  );
});

test('rejects individual attendance retrieval when lecturer profile is missing', async () => {
  const { prisma, calls } = createAttendanceDetailPrisma({
    lecturer: null,
  });

  await assert.rejects(
    () => getAttendanceSessionById(
      prisma,
      'user-1',
      'session-1'
    ),
    {
      message: 'Lecturer profile not found.',
      statusCode: 404,
    }
  );

  assert.equal(calls.sessionArgs, undefined);
});

test('rejects retrieval when attendance session does not exist', async () => {
  const { prisma } = createAttendanceDetailPrisma({
    session: null,
  });

  await assert.rejects(
    () => getAttendanceSessionById(
      prisma,
      'user-1',
      'unknown-session'
    ),
    {
      message: 'Attendance session not found.',
      statusCode: 404,
    }
  );
});

test('prevents lecturer from retrieving another lecturer attendance session', async () => {
  const { prisma, calls } = createAttendanceDetailPrisma();

  await getAttendanceSessionById(
    prisma,
    'user-1',
    'session-1'
  );

  assert.deepEqual(calls.sessionArgs.where, {
    id: 'session-1',
    lecturerProfileId: 'lecturer-1',
  });
});
