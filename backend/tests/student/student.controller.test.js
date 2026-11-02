import test from "node:test";
import assert from "node:assert/strict";
import { getProfile, getReports, getReportById, createReport, getAttendance } from "../../src/modules/student/student.controller.js";

function createResponse() {
	return {
		statusCode: null,
		body: null,
		status(code) { this.statusCode = code; return this; },
		json(body) { this.body = body; return this; },
	};
}

test("rejects requests without an authenticated user", async () => {
	const res = createResponse();
	await getProfile({ user: null, app: { locals: {} } }, res, () => {});
	assert.equal(res.statusCode, 401);
});

test("returns the authenticated user's student profile", async () => {
	let queriedUserId;
	const profile = { id: "profile-1", studentNumber: "STU-001" };
	const prisma = {
		studentProfile: {
			findUnique: async ({ where }) => {
				queriedUserId = where.userId;
				return profile;
			},
		},
	};
	const req = { user: { id: "user-1" }, app: { locals: { prisma } } };
	const res = createResponse();

	await getProfile(req, res, () => {});

	assert.equal(queriedUserId, "user-1");
	assert.equal(res.statusCode, 200);
	assert.deepEqual(res.body.data, profile);
});

test("passes database errors to shared error handling", async () => {
	const expectedError = new Error("Database failure");
	const prisma = { studentProfile: { findUnique: async () => { throw expectedError; } } };
	const req = { user: { id: "user-1" }, app: { locals: { prisma } } };
	let capturedError;

	await getProfile(req, createResponse(), (error) => { capturedError = error; });
	assert.equal(capturedError, expectedError);
});

test("returns the authenticated student's report list and pagination", async () => {
	const report = { id: "report-1", reference: "MM-001", status: "Submitted" };
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-profile-1" }) },
		missingMarkReport: {
			findMany: async () => [report],
			count: async () => 1,
		},
		$transaction: async (operations) => Promise.all(operations),
	};
	const req = {
		user: { id: "user-1" },
		app: { locals: { prisma } },
		query: { page: 1, limit: 10 },
	};
	const res = createResponse();

	await getReports(req, res, (error) => { throw error; });

	assert.equal(res.statusCode, 200);
	assert.equal(res.body.count, 1);
	assert.deepEqual(res.body.data, [report]);
	assert.deepEqual(res.body.pagination, { page: 1, limit: 10, total: 1, totalPages: 1 });
});

test("passes report-list service errors to shared error handling", async () => {
	const expectedError = new Error("Database failure");
	const prisma = { studentProfile: { findUnique: async () => { throw expectedError; } } };
	const req = { user: { id: "user-1" }, app: { locals: { prisma } }, query: {} };
	let capturedError;

	await getReports(req, createResponse(), (error) => { capturedError = error; });
	assert.equal(capturedError, expectedError);
});

test("returns the authenticated student's report detail", async () => {
	const report = { id: "report-1", reference: "MM-001", status: "Submitted" };
	let receivedArguments;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-profile-1" }) },
		missingMarkReport: { findFirst: async () => report },
	};
	const req = {
		user: { id: "user-1" },
		app: { locals: { prisma } },
		params: { reportId: "report-1" },
	};
	const res = createResponse();

	await getReportById(req, res, (error) => { receivedArguments = error; });

	assert.equal(receivedArguments, undefined);
	assert.equal(res.statusCode, 200);
	assert.deepEqual(res.body.data, report);
});

test("passes report-detail not-found errors to shared error handling", async () => {
	const expectedError = Object.assign(new Error("Missing-mark report not found."), { statusCode: 404 });
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-profile-1" }) },
		missingMarkReport: { findFirst: async () => { throw expectedError; } },
	};
	const req = {
		user: { id: "user-1" },
		app: { locals: { prisma } },
		params: { reportId: "report-1" },
	};
	let capturedError;

	await getReportById(req, createResponse(), (error) => { capturedError = error; });
	assert.equal(capturedError, expectedError);
});

test("creates a report using authenticated identity and returns 201", async () => {
	let receivedUserId;
	const report = { id: "report-1", status: "Submitted" };
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		unitEnrollment: { findUnique: async () => ({ id: "enrollment-1" }) },
		$transaction: async (callback) => callback({
			missingMarkReport: { create: async () => report },
			reportStatusHistory: { create: async () => ({}) },
			auditLog: { create: async () => ({}) },
		}),
	};
	const req = {
		user: { id: "user-1" },
		app: { locals: { prisma } },
		validatedBody: {
			courseUnitId: "unit-1",
			academicPeriodId: "period-1",
			assessmentComponent: "CAT 1",
			description: "My mark is missing.",
		},
	};
	const res = createResponse();

	await createReport(req, res, (error) => { throw error; });

	assert.equal(res.statusCode, 201);
	assert.deepEqual(res.body.data, report);
});

test("returns the authenticated student's attendance history and pagination", async () => {
	const record = { id: "history-1", courseUnitCode: "UNIT101", status: "Present" };
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		attendanceHistory: {
			findMany: async () => [record],
			count: async () => 1,
		},
		$transaction: async (operations) => Promise.all(operations),
	};
	const req = { user: { id: "user-1" }, app: { locals: { prisma } }, validatedQuery: { page: 1, limit: 10 } };
	const res = createResponse();

	await getAttendance(req, res, (error) => { throw error; });

	assert.equal(res.statusCode, 200);
	assert.equal(res.body.count, 1);
	assert.deepEqual(res.body.data, [record]);
	assert.deepEqual(res.body.pagination, { page: 1, limit: 10, total: 1, totalPages: 1 });
});