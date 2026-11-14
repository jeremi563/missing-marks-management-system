import { z } from "zod";

export const userNotificationsQuery = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(["all", "unread", "read"]).default("all"),
}).strict();

export const userNotificationIdParams = z.object({
	notificationId: z.string().uuid(),
}).strict();
