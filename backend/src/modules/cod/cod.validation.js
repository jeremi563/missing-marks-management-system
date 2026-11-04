import { z } from "zod";

export const getCodReportsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  status: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "status", "studentNumber"]).default("newest"),
});

export const codReportIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createCodReportCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

export const assignCodReportBodySchema = z.object({
  lecturerProfileId: z.string().uuid(),
  reason: z.string().trim().max(2000).optional(),
});

export const codReportDecisionBodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().min(1).max(2000),
}).strict();
