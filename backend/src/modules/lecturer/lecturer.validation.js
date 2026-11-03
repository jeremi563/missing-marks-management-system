import { z } from 'zod';

export const reportIdSchema = z.object({
  reportId: z.string().uuid('A valid report UUID is required.'),
});

// Feature 6: Attendance session ID validation
export const attendanceSessionIdSchema = z.object({
  sessionId: z.string().uuid('A valid attendance session UUID is required.'),
});

// Feature 3: Report investigation and comments
export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty.')
    .max(2000, 'Comment cannot exceed 2000 characters.'),
});

// Feature 4: Report decision submission
export const submitDecisionSchema = z.object({
  decision: z.enum(
    ['APPROVE', 'REJECT'],
    {
      errorMap: () => ({
        message: 'Decision must be APPROVE or REJECT.',
      }),
    }
  ),

  reason: z
    .string()
    .trim()
    .min(1, 'A reason is required for the decision.')
    .max(2000, 'Decision reason cannot exceed 2000 characters.'),
});

// Feature 5: Mark-correction proposal submission
export const submitCorrectionSchema = z.object({
  proposedValue: z
    .number()
    .finite()
    .nonnegative('Proposed mark cannot be negative.')
    .refine(
      (value) =>
        Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
      'Proposed mark cannot have more than two decimal places.'
    ),

  reason: z
    .string()
    .trim()
    .min(1, 'A justification is required for the correction.')
    .max(2000, 'Correction justification cannot exceed 2000 characters.'),
});

// Feature 6: Unified attendance session validation

export const createAttendanceSessionSchema = z
  .object({
    sessionType: z.enum(['CLASS', 'CAT', 'EXAM']),

    courseUnitId: z.string().uuid(
      'A valid course unit UUID is required.'
    ),

    classroomId: z.string().uuid(
      'A valid classroom UUID is required.'
    ),

    assessmentId: z
      .string()
      .uuid('A valid assessment UUID is required.')
      .optional(),

    startsAt: z.iso.datetime({
      offset: true,
      message: 'A valid session start datetime is required.',
    }),

    endsAt: z
      .iso.datetime({
        offset: true,
        message: 'A valid session end datetime is required.',
      })
      .optional(),
  })
  .superRefine((data, context) => {
    if (data.sessionType === 'CLASS' && data.assessmentId) {
      context.addIssue({
        code: 'custom',
        path: ['assessmentId'],
        message: 'CLASS sessions must not reference an assessment.',
      });
    }

    if (
      ['CAT', 'EXAM'].includes(data.sessionType) &&
      !data.assessmentId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['assessmentId'],
        message: 'CAT and EXAM sessions require an assessment.',
      });
    }

    if (!data.endsAt) return;

    if (Date.parse(data.endsAt) <= Date.parse(data.startsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Session end time must be after the start time.',
      });
    }
  });
