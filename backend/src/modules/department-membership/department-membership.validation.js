import { z } from "zod";

export const departmentMembershipRequestParams = z.object({ id: z.string().uuid() }).strict();
export const departmentMembershipDecisionBody = z.object({
	status: z.enum(["APPROVED", "REJECTED"]),
}).strict();
