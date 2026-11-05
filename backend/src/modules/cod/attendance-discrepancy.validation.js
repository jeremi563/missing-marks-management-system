import { z } from "zod";

export const attendanceDiscrepancyIdParamsSchema = z.object({ id: z.string().uuid() });

export const attendanceDiscrepancyListQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  status: z.enum(["PENDING_COD_REVIEW", "CLARIFICATION_REQUESTED", "CONFIRMED", "REJECTED", "CORRECTION_RECOMMENDED", "CORRECTION_AUTHORIZED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const codAttendanceDiscrepancyDecisionBodySchema = z.object({
  decision: z.enum(["CONFIRM_DISCREPANCY", "REJECT_DISCREPANCY", "REQUEST_CLARIFICATION", "RECOMMEND_CORRECTION", "AUTHORIZE_ATTENDANCE_CORRECTION"]),
  explanation: z.string().trim().min(1).max(2000),
}).strict();
