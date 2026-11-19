import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { loginRateLimit, recoveryRateLimit, registrationRateLimit } from "./auth.rate-limit.js";
import { avatarUpdateSchema, emailBodySchema, emailChangeSchema, lecturerDepartmentRegistrationSchema, loginSchema, passwordChangeSchema, passwordResetSchema, registerSchema, tokenBodySchema } from "./auth.validation.js";
import { changeEmailController, changePasswordController, extendSessionController, forgotPassword, getMe, getRegistrationDepartments, login, logout, register, registerLecturerDepartment, resendVerification, resetPasswordController, updateAvatarController, verifyEmail } from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.post("/login", loginRateLimit, validate(loginSchema), login);
authRoutes.get("/departments", getRegistrationDepartments);
authRoutes.post("/register", registrationRateLimit, validate(registerSchema), register);
authRoutes.post("/register-department", registrationRateLimit, validate(lecturerDepartmentRegistrationSchema), registerLecturerDepartment);
authRoutes.post("/verify-email", recoveryRateLimit, validate(tokenBodySchema), verifyEmail);
authRoutes.post("/resend-verification", recoveryRateLimit, validate(emailBodySchema), resendVerification);
authRoutes.post("/forgot-password", recoveryRateLimit, validate(emailBodySchema), forgotPassword);
authRoutes.post("/reset-password", recoveryRateLimit, validate(passwordResetSchema), resetPasswordController);
authRoutes.post("/change-password", authenticate, validate(passwordChangeSchema), changePasswordController);
authRoutes.post("/session/extend", authenticate, extendSessionController);
authRoutes.post("/change-email", recoveryRateLimit, authenticate, validate(emailChangeSchema), changeEmailController);
authRoutes.put("/avatar", authenticate, validate(avatarUpdateSchema), updateAvatarController);
authRoutes.post("/logout", logout);
authRoutes.get("/me", authenticate, getMe);
