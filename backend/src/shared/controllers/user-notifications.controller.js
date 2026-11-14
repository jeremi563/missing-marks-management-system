import { sendSuccess } from "../utils/api-response.js";
import {
	listUserNotifications,
	markAllUserNotificationsRead,
	markUserNotificationRead,
} from "../services/user-notifications.service.js";

export async function getUserNotifications(req, res, next) {
	try {
		const result = await listUserNotifications(req.app.locals.prisma, req.user.id, req.query);
		return sendSuccess(res, "Notifications retrieved successfully", result);
	} catch (error) {
		return next(error);
	}
}

export async function patchUserNotificationRead(req, res, next) {
	try {
		const result = await markUserNotificationRead(req.app.locals.prisma, req.user.id, req.params.notificationId);
		return sendSuccess(res, "Notification marked as read", result);
	} catch (error) {
		return next(error);
	}
}

export async function patchAllUserNotificationsRead(req, res, next) {
	try {
		const result = await markAllUserNotificationsRead(req.app.locals.prisma, req.user.id);
		return sendSuccess(res, "All notifications marked as read", result);
	} catch (error) {
		return next(error);
	}
}
