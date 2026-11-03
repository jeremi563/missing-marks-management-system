import test from "node:test";
import assert from "node:assert/strict";
import router from "../../src/modules/student/student.routes.js";
import {
	validateCreateStudentCommentBody,
	validateStudentNotificationId,
} from "../../src/modules/student/student.validation.js";

function route(path, method) {
	return router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method])?.route;
}

test("student report comments support authenticated read and clarification routes", () => {
	assert.equal(route("/reports/:reportId/comments", "get").stack.length, 4);
	assert.equal(route("/reports/:reportId/comments", "post").stack.length, 5);
});

test("notification read-state route requires authentication, student role, and UUID validation", () => {
	assert.equal(route("/notifications/:notificationId/read", "patch").stack.length, 4);
});

test("clarification validation trims text and rejects empty bodies or client authorship", () => {
	const req = { body: { body: "  Please review my submission.  " } };
	let validationError;
	validateCreateStudentCommentBody(req, {}, (error) => { validationError = error; });
	assert.equal(validationError, undefined);
	assert.deepEqual(req.validatedBody, { body: "Please review my submission." });

	for (const body of [{ body: "  " }, { body: "Reply", authorUserId: "forged" }]) {
		let error;
		validateCreateStudentCommentBody({ body }, {}, (captured) => { error = captured; });
		assert.equal(error.statusCode, 400);
	}
});

test("notification read-state validation accepts only UUID identifiers", () => {
	let validError;
	validateStudentNotificationId({ params: { notificationId: "550e8400-e29b-41d4-a716-446655440000" } }, {}, (error) => { validError = error; });
	assert.equal(validError, undefined);

	let invalidError;
	validateStudentNotificationId({ params: { notificationId: "not-a-uuid" } }, {}, (error) => { invalidError = error; });
	assert.equal(invalidError.statusCode, 400);
});
