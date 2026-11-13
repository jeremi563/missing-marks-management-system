import test from "node:test";
import assert from "node:assert/strict";
import {
	getEnrollmentRequestsForReviewer,
	postEnrollmentRequestDecision,
	postStudentEnrollmentRequests,
} from "../../src/modules/enrollment/enrollment-request.controller.js";

const userId = "00000000-0000-4000-8000-000000000001";
const periodId = "00000000-0000-4000-8000-000000000002";
const courseId = "00000000-0000-4000-8000-000000000003";
const requestId = "00000000-0000-4000-8000-000000000004";

function responseRecorder() {
	return {
		statusCode: 0,
		body: null,
		status(code) { this.statusCode = code; return this; },
		json(body) { this.body = body; return this; },
	};
}

test("student request controller passes the validated request body to the service", async () => {
	let createdRequest = false;
	const tx = {
		studentProfile: { findUnique: async () => ({ id: "student-profile", studentNumber: "IN16/00100/26" }) },
		academicPeriod: {
			findUnique: async () => ({
				id: periodId,
				name: "2026/27",
				enrollmentOpensAt: new Date("2026-09-01"),
				enrollmentClosesAt: new Date("2027-02-01"),
			}),
		},
		courseUnit: {
			findMany: async () => [{
				id: courseId,
				code: "IN101",
				department: { id: "department-id", name: "Computing", designatedCodUserId: null, members: [] },
				lecturerMappings: [{ lecturer: { userId: "lecturer-id" } }],
			}],
		},
		unitEnrollment: { findMany: async () => [] },
		studentEnrollmentRequest: {
			findMany: async () => [],
			create: async () => { createdRequest = true; return { id: requestId }; },
		},
		notification: { create: async () => ({}) },
		auditLog: { create: async () => ({}) },
	};
	const req = {
		user: { id: userId },
		body: { academicPeriodId: periodId, courseUnitIds: [courseId] },
		app: { locals: { prisma: { $transaction: async (callback) => callback(tx) } } },
	};
	const res = responseRecorder();
	let passedError;

	await postStudentEnrollmentRequests(req, res, (error) => { passedError = error; });

	assert.equal(passedError, undefined);
	assert.equal(res.statusCode, 201);
	assert.equal(createdRequest, true);
});

test("reviewer controller reads the validated query and body from Express request fields", async () => {
	let listQuery;
	const listReq = {
		user: { id: userId },
		query: { status: "PENDING" },
		app: {
			locals: {
				prisma: {
					lecturerProfile: {
						findFirst: async () => ({ id: "lecturer-profile", unitAssignments: [{ courseUnitId: courseId, academicYear: "2026/27" }] }),
					},
					departmentMembership: { findMany: async () => [] },
					user: { findFirst: async () => null },
					department: { findMany: async () => [] },
					academicPeriod: { findMany: async () => [{ id: periodId, name: "2026/27" }] },
					studentEnrollmentRequest: { findMany: async ({ where }) => { listQuery = where; return []; } },
				},
			},
		},
	};
	const listRes = responseRecorder();
	let listError;
	await getEnrollmentRequestsForReviewer(listReq, listRes, (error) => { listError = error; });

	assert.equal(listError, undefined);
	assert.deepEqual(listQuery, { status: "PENDING", OR: [{ courseUnitId: courseId, academicPeriodId: { in: [periodId] } }] });

	const decisionReq = {
		user: { id: userId },
		body: { requestIds: [requestId], decision: "REJECT" },
		app: {
			locals: {
				prisma: {
					$transaction: async (callback) => callback({
						lecturerProfile: { findFirst: async () => ({ id: "lecturer-profile", unitAssignments: [{ courseUnitId: courseId, academicYear: "2026/27" }] }) },
						departmentMembership: { findMany: async () => [] },
						user: { findFirst: async () => null },
						department: { findMany: async () => [] },
						academicPeriod: { findMany: async () => [{ id: periodId, name: "2026/27" }] },
						studentEnrollmentRequest: {
							findMany: async () => [{
								id: requestId,
								studentProfileId: "student-profile",
								courseUnitId: courseId,
								academicPeriodId: periodId,
								courseUnit: { departmentId: "department-id", code: "IN101", department: { name: "Computing" } },
								student: { userId: "student-user" },
								academicPeriod: { name: "2026/27" },
							}],
							updateMany: async () => ({ count: 1 }),
						},
						auditLog: { create: async () => ({}) },
						notification: { create: async () => ({}) },
					}),
				},
			},
		},
	};
	const decisionRes = responseRecorder();
	let decisionError;
	await postEnrollmentRequestDecision(decisionReq, decisionRes, (error) => { decisionError = error; });

	assert.equal(decisionError, undefined);
	assert.equal(decisionRes.statusCode, 200);
	assert.deepEqual(decisionRes.body.data, { count: 1, status: "REJECTED" });
});
