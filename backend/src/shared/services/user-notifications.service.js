import { AppError } from "../utils/app-error.js";

export async function listUserNotifications(db, userId, { page = 1, limit = 20, status = "all" } = {}) {
	const where = {
		userId,
		...(status === "unread" ? { readAt: null } : {}),
		...(status === "read" ? { readAt: { not: null } } : {}),
	};
	const [notifications, total, unreadCount] = await db.$transaction([
		db.notification.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				title: true,
				message: true,
				readAt: true,
				createdAt: true,
				report: { select: { id: true, reference: true, status: true } },
			},
			orderBy: { createdAt: "desc" },
		}),
		db.notification.count({ where }),
		db.notification.count({ where: { userId, readAt: null } }),
	]);

	return {
		notifications,
		unreadCount,
		pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
}

export async function markUserNotificationRead(db, userId, notificationId) {
	const notification = await db.notification.findFirst({
		where: { id: notificationId, userId },
		select: { id: true },
	});
	if (!notification) throw new AppError(404, "Notification not found");

	return db.notification.update({
		where: { id: notification.id },
		data: { readAt: new Date() },
		select: { id: true, readAt: true },
	});
}

export async function markAllUserNotificationsRead(db, userId) {
	const result = await db.notification.updateMany({
		where: { userId, readAt: null },
		data: { readAt: new Date() },
	});
	return { updatedCount: result.count };
}
