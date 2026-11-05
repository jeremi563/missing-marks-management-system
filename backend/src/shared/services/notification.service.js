import { prisma } from "../../config/database.js";

export async function createNotification({ userId, title, message, reportId, dedupeKey, prismaClient = prisma }) {
	const data = { userId, title, message, ...(reportId ? { reportId } : {}), ...(dedupeKey ? { dedupeKey } : {}) };
	if (dedupeKey) {
		await prismaClient.notification.createMany({ data: [data], skipDuplicates: true });
		return prismaClient.notification.findUnique({ where: { dedupeKey } });
	}
	return prismaClient.notification.create({ data });
}
