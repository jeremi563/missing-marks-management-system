import test from "node:test";
import assert from "node:assert/strict";
import { getStudentProfile, getStudentReports } from "../../src/modules/student/student.service.js";

test("loads profile by authenticated user ID and selects only permitted fields", async () => {
	let query;
	const expectedProfile = {
		id: "profile-1",
		studentNumber: "STU-001",
		officialEmail: "student@university.example.test",
		notificationEmail: "student@example.test",
		user: { id: "user-1", displayName: "Example Student", email: "student@example.test" },
	};
	const prisma = {
		studentProfile: {
			findUnique: async (args) => {
				query = args;
				return expectedProfile;
			},
		},
	};

	const result = await getStudentProfile(prisma, "user-1");

	assert.deepEqual(query.where, { userId: "user-1" });
	assert.deepEqual(result, expectedProfile);
	assert.equal("passwordHash" in query.select.user.select, false);
});

test("returns not found when the authenticated user has no student profile", async () => {
	const prisma = { studentProfile: { findUnique: async () => null } };
	await assert.rejects(getStudentProfile(prisma, "user-1"), { statusCode: 404 });
});

test("lists only the authenticated student's reports with pagination", async () => {
	const reports = [{ id: "report-1", reference: "MM-001", status: "Submitted" }];
	let listQuery;
	let countQuery;
	const prisma = {
		studentProfile: {
			findUnique: async ({ where }) => {
				assert.deepEqual(where, { userId: "user-1" });
				return { id: "student-profile-1" };
			},
		},
		missingMarkReport: {
			findMany: async (query) => { listQuery = query; return reports; },
			count: async (query) => { countQuery = query; return 13; },
		},
		$transaction: async (operations) => Promise.all(operations),
	};

	const result = await getStudentReports(prisma, "user-1", { page: 2, limit: 5 });

	assert.deepEqual(listQuery.where, { studentProfileId: "student-profile-1" });
	assert.deepEqual(countQuery.where, listQuery.where);
	assert.equal(listQuery.skip, 5);
	assert.equal(listQuery.take, 5);
	assert.deepEqual(listQuery.orderBy, { createdAt: "desc" });
	assert.deepEqual(result.reports, reports);
	assert.deepEqual(result.pagination, { page: 2, limit: 5, total: 13, totalPages: 3 });
});

test("does not query reports when the authenticated user has no student profile", async () => {
	let reportQueryCalled = false;
	const prisma = {
		studentProfile: { findUnique: async () => null },
		missingMarkReport: {
			findMany: async () => { reportQueryCalled = true; return []; },
			count: async () => { reportQueryCalled = true; return 0; },
		},
		$transaction: async (operations) => Promise.all(operations),
	};

	await assert.rejects(getStudentReports(prisma, "user-1"), { statusCode: 404 });
	assert.equal(reportQueryCalled, false);
});