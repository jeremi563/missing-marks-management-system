import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getProfile, getReports } from "./student.controller.js";
import { validateReportListQuery } from "./student.validation.js";

const router = Router();

router.get("/profile", authenticate, authorize("student"), getProfile);
router.get("/reports", authenticate, authorize("student"), validateReportListQuery, getReports);

export default router;
