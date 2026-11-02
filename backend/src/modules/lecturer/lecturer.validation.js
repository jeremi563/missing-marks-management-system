import { z } from 'zod';

export const reportIdSchema = z.object({
  reportId: z.string().uuid('A valid report UUID is required.'),
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
