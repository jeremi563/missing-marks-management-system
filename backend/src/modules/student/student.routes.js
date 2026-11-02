import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getProfile, getReports, getReportById } from "./student.controller.js";
import { validateReportListQuery, validateStudentReportId } from "./student.validation.js";

const router = Router();

router.get("/profile", authenticate, authorize("student"), getProfile);
router.get("/reports", authenticate, authorize("student"), validateReportListQuery, getReports);
router.get("/reports/:reportId", authenticate, authorize("student"), validateStudentReportId, getReportById);

export default router;
