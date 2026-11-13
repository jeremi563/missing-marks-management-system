import test from "node:test";
import assert from "node:assert/strict";
import router from "../../src/modules/student/student.routes.js";
import { validateReportListQuery, validateStudentReportId, validateCreateReportBody, validateStudentAttendanceCheckIn } from "../../src/modules/student/student.validation.js";

test("registers GET /profile with authentication and student-role checks", () => {
	const profileRoute = router.stack.find((layer) => layer.route?.path === "/profile");
	assert.ok(profileRoute);
	assert.equal(profileRoute.route.methods.get, true);
	assert.equal(profileRoute.route.stack.length, 3);
});

test("registers the student course-enrollment options and request endpoints", () => {
	const optionsRoute = router.stack.find((layer) => layer.route?.path === "/enrollment-options");
	const requestRoute = router.stack.find((layer) => layer.route?.path === "/enrollment-requests" && layer.route.methods.post);
	assert.ok(optionsRoute);
	assert.equal(optionsRoute.route.methods.get, true);
	assert.equal(optionsRoute.route.stack.length, 3);
	assert.ok(requestRoute);
	assert.equal(requestRoute.route.stack.length, 4);
});

test("registers GET /report-options with authentication and student-role checks", () => {
	const optionsRoute = router.stack.find((layer) => layer.route?.path === "/report-options");
	assert.ok(optionsRoute);
	assert.equal(optionsRoute.route.methods.get, true);
	assert.equal(optionsRoute.route.stack.length, 3);
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

test("registers POST /reports with auth, student-role, and body validation", () => {
	const reportsRoute = router.stack.find((layer) => layer.route?.path === "/reports" && layer.route.methods.post);
	assert.equal(reportsRoute.route.methods.post, true);
	assert.equal(reportsRoute.route.stack.length, 4);
});

test("registers GET /attendance with auth, student-role, and pagination validation", () => {
	const attendanceRoute = router.stack.find((layer) => layer.route?.path === "/attendance");
	assert.ok(attendanceRoute);
	assert.equal(attendanceRoute.route.methods.get, true);
	assert.equal(attendanceRoute.route.stack.length, 4);
});

test("registers POST /attendance/check-in with student auth, role checks and location validation", () => {
	const route = router.stack.find((layer) => layer.route?.path === "/attendance/check-in");
	assert.ok(route);
	assert.equal(route.route.methods.post, true);
	assert.equal(route.route.stack.length, 4);
});

test("validates attendance check-in token and GPS coordinates", () => {
	const req = {
		body: {
			token: "a".repeat(64),
			latitude: -1.286389,
			longitude: 36.817223,
			accuracyMeters: 12,
		},
	};
	let capturedError;
	validateStudentAttendanceCheckIn(req, {}, (error) => { capturedError = error; });
	assert.equal(capturedError, undefined);
	assert.deepEqual(req.validatedBody, req.body);

	let coarseLocationError;
	const coarseLocationRequest = { body: { ...req.body, accuracyMeters: 6000 } };
	validateStudentAttendanceCheckIn(coarseLocationRequest, {}, (error) => { coarseLocationError = error; });
	assert.equal(coarseLocationError, undefined);
	assert.equal(coarseLocationRequest.validatedBody.accuracyMeters, 6000);

	let invalidError;
	validateStudentAttendanceCheckIn({ body: { ...req.body, latitude: 91 } }, {}, (error) => { invalidError = error; });
	assert.equal(invalidError.statusCode, 400);
});

test("registers GET /notifications with auth, student-role, and pagination validation", () => {
	const notificationsRoute = router.stack.find((layer) => layer.route?.path === "/notifications");
	assert.ok(notificationsRoute);
	assert.equal(notificationsRoute.route.methods.get, true);
	assert.equal(notificationsRoute.route.stack.length, 4);
});

test("validates report submission fields and rejects client identity fields", () => {
	const req = {
		body: {
			courseUnitId: "550e8400-e29b-41d4-a716-446655440000",
			academicYear: "2026/27",
			assessmentComponent: "CAT 1",
			description: "My CAT mark is missing.",
		},
	};
	let validationError;
	validateCreateReportBody(req, {}, (error) => { validationError = error; });
	assert.equal(validationError, undefined);
	assert.equal(req.validatedBody.assessmentId, undefined);

	const noAssessmentMetadataRequest = { body: { ...req.body, assessmentComponent: undefined } };
	delete noAssessmentMetadataRequest.body.assessmentComponent;
	let noAssessmentMetadataError;
	validateCreateReportBody(noAssessmentMetadataRequest, {}, (error) => { noAssessmentMetadataError = error; });
	assert.equal(noAssessmentMetadataError, undefined);

	let invalidAcademicYearError;
	validateCreateReportBody({ body: { ...req.body, academicYear: "2027/28" } }, {}, (error) => { invalidAcademicYearError = error; });
	assert.equal(invalidAcademicYearError, undefined);
	validateCreateReportBody({ body: { ...req.body, academicYear: "2026/2027" } }, {}, (error) => { invalidAcademicYearError = error; });
	assert.equal(invalidAcademicYearError.statusCode, 400);

	let identityError;
	validateCreateReportBody({ body: { ...req.body, studentProfileId: "forged" } }, {}, (error) => { identityError = error; });
	assert.equal(identityError.statusCode, 400);
});
test("does not register the deprecated singular appeal alias", () => {
	const duplicateAppealRoute = router.stack.find((layer) => layer.route?.path === "/reports/:reportId/appeal");
	assert.equal(duplicateAppealRoute, undefined);
	const pluralAppealRoute = router.stack.find((layer) => layer.route?.path === "/reports/:reportId/appeals");
	assert.ok(pluralAppealRoute);
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