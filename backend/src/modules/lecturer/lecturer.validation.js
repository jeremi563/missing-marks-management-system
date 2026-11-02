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