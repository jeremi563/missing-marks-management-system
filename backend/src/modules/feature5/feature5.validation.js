import { z } from "zod";

export const reportIdParams = z.object({ reportId: z.string().uuid() });
export const itemIdParams = z.object({ id: z.string().uuid() });
export const appealIdParams = z.object({ appealId: z.string().uuid() });
export const specialCaseIdParams = z.object({ caseId: z.string().uuid() });
export const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
export const statusPageQuery = pageQuery.extend({ status: z.string().trim().min(1).max(40).optional() }).strict();
export const createSpecialCaseBody = z.object({ categoryId: z.string().uuid(), description: z.string().trim().min(1).max(5000) }).strict();
export const decisionBody = z.object({ decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(1).max(2000) }).strict();
export const categoryCreateBody = z.object({ code: z.string().trim().regex(/^[A-Z0-9_]{2,60}$/), name: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional() }).strict();
export const categoryUpdateBody = categoryCreateBody.extend({ isActive: z.boolean().optional() }).strict();
export const holidayQuery = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }).strict();
export const holidayCreateBody = z.object({ date: z.iso.date(), name: z.string().trim().min(1).max(200), source: z.string().trim().max(500).optional(), description: z.string().trim().max(1000).optional() }).strict();
export const holidayUpdateBody = holidayCreateBody;
export const holidayIdParams = z.object({ id: z.string().uuid() });
export const departmentIdParams = z.object({ departmentId: z.string().uuid() });
export const designationBody = z.object({ codUserId: z.string().uuid() }).strict();
export const assessmentTypeDecisionFields = {
	assessmentTypeId: z.string().uuid(),
	assessmentTypeOtherDescription: z.string().trim().max(2000).optional(),
};
