import { prisma } from "../config/database.js";
import { logger } from "../shared/utils/logger.js";
import { runNotificationWorker } from "../shared/services/notification-outbox.service.js";

runNotificationWorker({ logger })
	.catch((error) => {
		logger.error("Notification worker stopped unexpectedly", { message: error.message });
		process.exitCode = 1;
	})
	.finally(async () => prisma.$disconnect());
