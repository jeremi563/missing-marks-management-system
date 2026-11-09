import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { loginRateLimit, recoveryRateLimit, registrationRateLimit } from "./auth.rate-limit.js";
import { emailBodySchema, loginSchema, passwordResetSchema, registerSchema, tokenBodySchema } from "./auth.validation.js";
import { forgotPassword, getMe, login, logout, register, resendVerification, resetPasswordController, verifyEmail } from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.post("/login", loginRateLimit, validate(loginSchema), login);
authRoutes.post("/register", registrationRateLimit, validate(registerSchema), register);
authRoutes.post("/verify-email", recoveryRateLimit, validate(tokenBodySchema), verifyEmail);
authRoutes.post("/resend-verification", recoveryRateLimit, validate(emailBodySchema), resendVerification);
authRoutes.post("/forgot-password", recoveryRateLimit, validate(emailBodySchema), forgotPassword);
authRoutes.post("/reset-password", recoveryRateLimit, validate(passwordResetSchema), resetPasswordController);
authRoutes.post("/logout", logout);
authRoutes.get("/me", authenticate, getMe);
