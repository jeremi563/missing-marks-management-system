import { rateLimit } from "express-rate-limit";

const options = { standardHeaders: true, legacyHeaders: false };

export const loginRateLimit = rateLimit({
	...options,
	windowMs: 15 * 60 * 1000,
	limit: 10,
	skipSuccessfulRequests: true,
	message: { success: false, message: "Too many sign-in attempts. Try again later." },
});

export const registrationRateLimit = rateLimit({
	...options,
	windowMs: 60 * 60 * 1000,
	limit: 5,
	message: { success: false, message: "Too many registration attempts. Try again later." },
});

export const recoveryRateLimit = rateLimit({
	...options,
	windowMs: 15 * 60 * 1000,
	limit: 5,
	message: { success: false, message: "Too many requests. Try again later." },
});