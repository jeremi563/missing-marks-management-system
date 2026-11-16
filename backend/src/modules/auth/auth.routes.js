import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { loginSchema } from "./auth.validation.js";
import { getMe, login, logout } from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.post("/login", validate(loginSchema), login);
authRoutes.post("/logout", logout);
authRoutes.get("/me", authenticate, getMe);
