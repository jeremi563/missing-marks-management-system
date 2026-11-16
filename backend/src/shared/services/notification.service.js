import { prisma } from "../../config/database.js";

export async function createNotification({ userId, title, message, reportId }) {
	return prisma.notification.create({
		data: { userId, title, message, reportId },
	});
}
