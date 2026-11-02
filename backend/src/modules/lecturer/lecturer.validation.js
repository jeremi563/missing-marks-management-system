import { z } from 'zod';

export const reportIdSchema = z.object({
  reportId: z.string().uuid('A valid report UUID is required.'),
});