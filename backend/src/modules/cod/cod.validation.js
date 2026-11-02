import { z } from "zod";

export const getCodReportsQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  status: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "status", "studentNumber"]).default("newest"),
});
