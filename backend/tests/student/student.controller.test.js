import test from "node:test";
import assert from "node:assert/strict";
import { getProfile, getReports } from "../../src/modules/student/student.controller.js";
import { getProfile } from "../../src/modules/student/student.controller.js";

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