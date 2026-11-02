import { z } from 'zod';

export const reportIdSchema = z.object({
  reportId: z.string().uuid('A valid report UUID is required.'),
});
//feature 3:: report investigation and comments
export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty.')
    .max(2000, 'Comment cannot exceed 2000 characters.'),
});

//  feature 4: Report decision submission

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
