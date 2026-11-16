import test from "node:test";
import assert from "node:assert/strict";
import { addClarification, markNotificationRead } from "../../src/modules/student/student.controller.js";

function response() {
	return {
		statusCode: null,
		body: null,
		status(code) { this.statusCode = code; return this; },
		json(body) { this.body = body; return this; },
	};
}

test("student clarification controller uses the authenticated author and returns created", async () => {
	let commentData;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		missingMarkReport: { findFirst: async () => ({ id: "report-1", studentProfileId: "student-1" }) },
		reportComment: { create: async ({ data }) => { commentData = data; return { id: "comment-1", ...data }; } },
	};
	const res = response();
	await addClarification({
		user: { id: "user-1" },
		app: { locals: { prisma } },
		params: { reportId: "report-1" },
		validatedBody: { body: "Please review my submission." },
	}, res, (error) => { throw error; });

	assert.equal(res.statusCode, 201);
	assert.equal(commentData.authorUserId, "user-1");
	assert.equal(commentData.isStudentVisible, true);
});

test("notification read controller returns only the authenticated user's notification", async () => {
	let updateWhere;
	const notification = { id: "notice-1", readAt: new Date() };
	const prisma = {
		notification: {
			updateMany: async ({ where }) => { updateWhere = where; return { count: 1 }; },
			findFirst: async ({ where }) => where.userId === "user-1" ? notification : null,
		},
	};
	const res = response();
	await markNotificationRead({
		user: { id: "user-1" },
		app: { locals: { prisma } },
		params: { notificationId: "notice-1" },
	}, res, (error) => { throw error; });

	assert.equal(res.statusCode, 200);
	assert.deepEqual(updateWhere, { id: "notice-1", userId: "user-1", readAt: null });
	assert.equal(res.body.data, notification);
});
