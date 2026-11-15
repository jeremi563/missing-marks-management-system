import { rateLimit } from "express-rate-limit";

export const examBookletScanRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: true,
	legacyHeaders: false,
	message: { success: false, message: "Too many examination booklet scan attempts. Try again later." },
});
