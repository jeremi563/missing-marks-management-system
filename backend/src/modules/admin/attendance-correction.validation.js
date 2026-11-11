import { z } from "zod";

export const attendanceCorrectionBodySchema = z.object({
	discrepancyDecisionId: z.string().uuid(),
	correctedStatus: z.enum(["PRESENT", "ABSENT", "LATE"]),
	reason: z.string().trim().min(1).max(2000),
}).strict();
