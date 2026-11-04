import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getProfile, getReports, getReportById, createReport, getAttendance, getNotifications, updateReport, withdrawReport, getReportComments, addClarification, submitAppeal, markNotificationRead } from "./student.controller.js";
import { validateReportListQuery, validateStudentReportId, validateCreateReportBody, validateUpdateReportBody, validateCreateAppealBody, validateCreateStudentCommentBody, validateStudentNotificationId } from "./student.validation.js";

const router = Router();

router.get("/profile", authenticate, authorize("student"), getProfile);
router.get("/reports", authenticate, authorize("student"), validateReportListQuery, getReports);
router.post("/reports", authenticate, authorize("student"), validateCreateReportBody, createReport);
router.get("/reports/:reportId", authenticate, authorize("student"), validateStudentReportId, getReportById);
router.get("/reports/:reportId/comments", authenticate, authorize("student"), validateStudentReportId, getReportComments);
router.post("/reports/:reportId/comments", authenticate, authorize("student"), validateStudentReportId, validateCreateStudentCommentBody, addClarification);
router.patch("/reports/:reportId", authenticate, authorize("student"), validateStudentReportId, validateUpdateReportBody, updateReport);
router.post("/reports/:reportId/withdraw", authenticate, authorize("student"), validateStudentReportId, withdrawReport);
router.post("/reports/:reportId/appeals", authenticate, authorize("student"), validateStudentReportId, validateCreateAppealBody, submitAppeal);
router.get("/attendance", authenticate, authorize("student"), validateReportListQuery, getAttendance);
router.get("/notifications", authenticate, authorize("student"), validateReportListQuery, getNotifications);
router.patch("/notifications/:notificationId/read", authenticate, authorize("student"), validateStudentNotificationId, markNotificationRead);

export default router;
