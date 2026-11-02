import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { getCodReports } from "./cod.controller.js";
import { getCodReportsQuerySchema } from "./cod.validation.js";

export const codRoutes = Router();

codRoutes.use(authenticate);
codRoutes.use(authorize("cod"));
codRoutes.get("/reports", validate(getCodReportsQuerySchema, "query"), getCodReports);