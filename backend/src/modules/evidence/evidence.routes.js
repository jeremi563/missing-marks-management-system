import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { downloadEvidence } from "./evidence.controller.js";

const evidenceIdParams = z.object({ evidenceId: z.string().uuid() }).strict();
export const evidenceRoutes = Router();

evidenceRoutes.get(
	"/:evidenceId",
	authenticate,
	authorize("student", "lecturer", "cod"),
	validate(evidenceIdParams, "params"),
	downloadEvidence,
);
