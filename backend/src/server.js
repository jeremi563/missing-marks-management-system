import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { logger } from "./shared/utils/logger.js";
import { completeExpiredAttendanceSessions } from "./modules/lecturer/lecturer.service.js";

const server = app.listen(env.PORT, "0.0.0.0", () => {
	logger.info("API server started", { port: env.PORT, environment: env.NODE_ENV });
});

if (env.NODE_ENV === "production") {
	prisma.$connect().catch((error) => {
		logger.error("Database connection failed", { errorName: error.name, errorCode: error.code });
		server.close(() => process.exit(1));
	});
}

let attendanceExpiryCheckRunning = false;
const expireAttendanceSessions = async () => {
	if (attendanceExpiryCheckRunning) return;
	attendanceExpiryCheckRunning = true;
	try {
		const completedCount = await completeExpiredAttendanceSessions(prisma);
		if (completedCount > 0) {
			logger.info("Expired attendance sessions completed", { count: completedCount });
		}
	} catch (error) {
		logger.error("Attendance session expiry check failed", {
			errorName: error.name,
			errorCode: error.code,
		});
	} finally {
		attendanceExpiryCheckRunning = false;
	}
};

void expireAttendanceSessions();
const attendanceExpiryTimer = setInterval(expireAttendanceSessions, 15_000);

async function shutdown(signal) {
	logger.info("Graceful shutdown started", { signal });
	clearInterval(attendanceExpiryTimer);
	server.close(async () => {
		try {
			await prisma.$disconnect();
			logger.info("Graceful shutdown complete");
			process.exitCode = 0;
		} catch (error) {
			logger.error("Database disconnect failed", { errorName: error.name, errorCode: error.code });
			process.exitCode = 1;
		}
	});
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
