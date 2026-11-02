import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getProfile } from "./student.controller.js";

const router = Router();

router.get("/profile", authenticate, authorize("student"), getProfile);

export default router;
