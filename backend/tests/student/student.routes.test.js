import test from "node:test";
import assert from "node:assert/strict";
import router from "../../src/modules/student/student.routes.js";

test("registers GET /profile with authentication and student-role checks", () => {
	const profileRoute = router.stack.find((layer) => layer.route?.path === "/profile");
	assert.ok(profileRoute);
	assert.equal(profileRoute.route.methods.get, true);
	assert.equal(profileRoute.route.stack.length, 3);
});

test("student-role middleware rejects other roles", () => {
	const profileRoute = router.stack.find((layer) => layer.route?.path === "/profile");
	const authorizeStudent = profileRoute.route.stack[1].handle;
	let capturedError;

	authorizeStudent({ user: { roles: ["lecturer"] } }, {}, (error) => {
		capturedError = error;
	});

	assert.equal(capturedError.statusCode, 403);
});

test("student-role middleware allows the student role", () => {
	const profileRoute = router.stack.find((layer) => layer.route?.path === "/profile");
	const authorizeStudent = profileRoute.route.stack[1].handle;
	let calledNext = false;

	authorizeStudent({ user: { roles: ["student"] } }, {}, (error) => {
		assert.equal(error, undefined);
		calledNext = true;
	});

	assert.equal(calledNext, true);
});