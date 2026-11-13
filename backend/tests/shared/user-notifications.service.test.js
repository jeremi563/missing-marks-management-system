import test from "node:test";
import assert from "node:assert/strict";
import {
	listUserNotifications,
	markAllUserNotificationsRead,
	markUserNotificationRead,
} from "../../src/shared/services/user-notifications.service.js";

test("lists notifications only for the user and applies unread filters with an unread count", async () => {
	const queries = [];
	const notifications = [{ id: "notification-1", readAt: null }];
	const db = {
		notification: {
			findMany: async (query) => { queries.push(query); return notifications; },
			count: async (query) => { queries.push(query); return query.where.readAt === null ? 3 : 1; },
		},
		$transaction: async (operations) => Promise.all(operations),
	};

	const result = await listUserNotifications(db, "user-1", { page: 2, limit: 10, status: "unread" });

	assert.equal(result.notifications, notifications);
	assert.equal(result.unreadCount, 3);
	assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 3, totalPages: 1 });
	assert.deepEqual(queries[0].where, { userId: "user-1", readAt: null });
	assert.deepEqual(queries[0].skip, 10);
	assert.equal(queries[0].take, 10);
});

test("marks a notification read only when it belongs to the requesting user", async () => {
	let updated;
	const db = {
		notification: {
			findFirst: async ({ where }) => where.userId === "user-1" ? { id: "notification-1" } : null,
			update: async (query) => { updated = query; return { id: query.where.id, readAt: query.data.readAt }; },
		},
	};

	const result = await markUserNotificationRead(db, "user-1", "notification-1");

	assert.equal(result.id, "notification-1");
	assert.ok(updated.data.readAt instanceof Date);
	await assert.rejects(markUserNotificationRead(db, "other-user", "notification-1"), { statusCode: 404 });
});

test("marks all unread notifications for one user in a single update", async () => {
	let update;
	const db = {
		notification: {
			updateMany: async (query) => { update = query; return { count: 4 }; },
		},
	};

	assert.deepEqual(await markAllUserNotificationsRead(db, "user-1"), { updatedCount: 4 });
	assert.deepEqual(update.where, { userId: "user-1", readAt: null });
	assert.ok(update.data.readAt instanceof Date);
});
