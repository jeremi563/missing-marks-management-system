import test from "node:test";
import assert from "node:assert/strict";
import router from "../../src/modules/student/student.routes.js";
import { validateReportListQuery, validateStudentReportId } from "../../src/modules/student/student.validation.js";

test("registers GET /profile with authentication and student-role checks", () => {
	const profileRoute = router.stack.find((layer) => layer.route?.path === "/profile");
	assert.ok(profileRoute);
	assert.equal(profileRoute.route.methods.get, true);
	assert.equal(profileRoute.route.stack.length, 3);
});

test("registers GET /reports with auth, student-role, and query validation", () => {
	const reportsRoute = router.stack.find((layer) => layer.route?.path === "/reports");
	assert.ok(reportsRoute);
	assert.equal(reportsRoute.route.methods.get, true);
	assert.equal(reportsRoute.route.stack.length, 4);
});

test("parses pagination into a separate validated query field", () => {
	const req = { query: { page: "2", limit: "25" } };
	let calledNext = false;

	validateReportListQuery(req, {}, (error) => {
		assert.equal(error, undefined);
		calledNext = true;
	});

	assert.equal(calledNext, true);
	assert.deepEqual(req.validatedQuery, { page: 2, limit: 25 });
	assert.deepEqual(req.query, { page: "2", limit: "25" });
});

test("rejects out-of-range and unknown report-list query parameters", () => {
	for (const query of [{ page: "0" }, { limit: "101" }, { status: "Submitted" }]) {
		let capturedError;
		validateReportListQuery({ query }, {}, (error) => { capturedError = error; });
		assert.equal(capturedError.statusCode, 400);
	}
});

test("registers GET /reports/:reportId with auth, student-role, and UUID validation", () => {
	const reportRoute = router.stack.find((layer) => layer.route?.path === "/reports/:reportId");
	assert.ok(reportRoute);
	assert.equal(reportRoute.route.methods.get, true);
	assert.equal(reportRoute.route.stack.length, 4);
});

test("validates student report IDs as UUIDs", () => {
	let validError;
	const validRequest = { params: { reportId: "550e8400-e29b-41d4-a716-446655440000" } };
	validateStudentReportId(validRequest, {}, (error) => { validError = error; });
	assert.equal(validError, undefined);
	assert.deepEqual(validRequest.validatedParams, validRequest.params);

	let invalidError;
	validateStudentReportId({ params: { reportId: "bad-id" } }, {}, (error) => { invalidError = error; });
	assert.equal(invalidError.statusCode, 400);
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