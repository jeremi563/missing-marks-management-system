import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getProfile, getReports, getReportById, createReport, getAttendance, getNotifications } from "./student.controller.js";
import { validateReportListQuery, validateStudentReportId, validateCreateReportBody } from "./student.validation.js";

const router = Router();

router.get("/profile", authenticate, authorize("student"), getProfile);
router.get("/reports", authenticate, authorize("student"), validateReportListQuery, getReports);
router.post("/reports", authenticate, authorize("student"), validateCreateReportBody, createReport);
router.get("/reports/:reportId", authenticate, authorize("student"), validateStudentReportId, getReportById);
router.get("/attendance", authenticate, authorize("student"), validateReportListQuery, getAttendance);
router.get("/notifications", authenticate, authorize("student"), validateReportListQuery, getNotifications);

export default router;
