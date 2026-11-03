import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { assignCodReport, getCodEligibleLecturers, getCodReports } from "./cod.controller.js";
import { assignCodReportBodySchema, codReportIdParamsSchema, getCodReportsQuerySchema } from "./cod.validation.js";

export const codRoutes = Router();

codRoutes.use(authenticate);
codRoutes.use(authorize("cod"));
codRoutes.get("/reports", validate(getCodReportsQuerySchema, "query"), getCodReports);
codRoutes.get("/reports/:id/eligible-lecturers", validate(codReportIdParamsSchema, "params"), getCodEligibleLecturers);
codRoutes.post(
  "/reports/:id/assign",
  validate(codReportIdParamsSchema, "params"),
  validate(assignCodReportBodySchema, "body"),
  assignCodReport,
);
