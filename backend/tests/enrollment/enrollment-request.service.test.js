import test from "node:test";
import assert from "node:assert/strict";
import {
	createStudentEnrollmentRequests,
	decideEnrollmentRequests,
	listEnrollmentRequestsForReviewer,
	listStudentEnrollmentOptions,
} from "../../src/modules/enrollment/enrollment-request.service.js";

test("lists the student's department and course units, current periods, and existing request state", async () => {
	let courseQuery;
	let enrollmentQuery;
	let requestQuery;
	const requests = [{ id: "request-1", status: "PENDING" }];
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		courseUnit: { findMany: async (query) => {
			courseQuery = query;
			return [{
				id: "unit-1",
				code: "IN101",
				name: "Computing",
				department: { id: "department-1", name: "Information Technology", initials: "IN" },
				lecturerMappings: [{ lecturer: { user: { id: "lecturer-1", displayName: "Lecturer One" } } }],
			}];
		} },
		academicPeriod: { findMany: async () => [
			{ id: "period-current", name: "2026/27", enrollmentOpensAt: new Date("2026-09-01"), enrollmentClosesAt: new Date("2027-02-01") },
			{ id: "period-future", name: "2027/28", enrollmentOpensAt: new Date("2027-09-01"), enrollmentClosesAt: new Date("2028-02-01") },
		] },
		unitEnrollment: { findMany: async (query) => { enrollmentQuery = query; return []; } },
		studentEnrollmentRequest: { findMany: async (query) => { requestQuery = query; return requests; } },
	};

	const result = await listStudentEnrollmentOptions(prisma, "student-1", new Date("2026-11-12"));

	assert.deepEqual(courseQuery.where, { department: { initials: "IN" }, course: { is: { code: "16" } } });
	assert.deepEqual(enrollmentQuery.where, {
		studentProfileId: "student-1",
		courseUnit: { department: { initials: "IN" }, course: { is: { code: "16" } } },
	});
	assert.deepEqual(requestQuery.where, enrollmentQuery.where);
	assert.deepEqual(courseQuery.select.lecturerMappings, {
			where: {
				academicYear: { in: ["2026/27"] },
				lecturer: { user: { isActive: true, approvalStatus: "APPROVED" } },
			},
			select: { lecturer: { select: { user: { select: { id: true, displayName: true } } } } },
	});
	assert.deepEqual(result.courses[0].lecturers, [{ id: "lecturer-1", displayName: "Lecturer One" }]);
	assert.deepEqual(result.academicPeriods.map(({ id }) => id), ["period-current"]);
	assert.deepEqual(result.requests, requests);
});

test("creates one request per selected assigned course and notifies its lecturer", async () => {
	const requests = [];
	const notifications = [];
	const audits = [];
	let courseQuery;
	const tx = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		academicPeriod: { findUnique: async () => ({ id: "period-1", name: "2026/27", enrollmentOpensAt: new Date("2026-09-01"), enrollmentClosesAt: new Date("2027-02-01") }) },
		courseUnit: { findMany: async (query) => {
			courseQuery = query;
			return [{
				id: "unit-1",
				code: "IN101",
				department: { id: "department-1", name: "Information Technology", designatedCodUserId: null, members: [] },
				lecturerMappings: [{ lecturer: { userId: "lecturer-1" } }],
			}];
		} },
		unitEnrollment: { findMany: async () => [] },
		studentEnrollmentRequest: {
			findMany: async () => [],
			create: async ({ data, select }) => {
				const request = { id: "request-1", ...data, status: "PENDING", createdAt: new Date() };
				requests.push(request);
				return Object.fromEntries(Object.keys(select).map((key) => [key, request[key]]));
			},
		},
		notification: { create: async ({ data }) => { notifications.push(data); } },
		auditLog: { create: async ({ data }) => { audits.push(data); } },
	};
	const db = { $transaction: async (callback) => callback(tx) };

	const result = await createStudentEnrollmentRequests(db, "student-1", {
		academicPeriodId: "period-1",
		courseUnitIds: ["unit-1"],
	}, new Date("2026-11-12"));

	assert.equal(result.length, 1);
	assert.deepEqual(courseQuery.where.department, { initials: "IN" });
	assert.deepEqual(courseQuery.where.course, { is: { code: "16" } });
	assert.equal(requests[0].studentProfileId, "student-1");
	assert.equal(requests[0].courseUnitId, "unit-1");
	assert.equal(notifications[0].userId, "lecturer-1");
	assert.equal(audits[0].action, "STUDENT_ENROLLMENT_REQUEST_SUBMITTED");
});

test("prevents enrollment requests to another department or an unassigned course", async () => {
	const tx = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		academicPeriod: { findUnique: async () => ({ id: "period-1", name: "2026/27", enrollmentOpensAt: new Date("2026-09-01"), enrollmentClosesAt: new Date("2027-02-01") }) },
		courseUnit: { findMany: async () => [] },
	};
	const db = { $transaction: async (callback) => callback(tx) };

	await assert.rejects(createStudentEnrollmentRequests(db, "student-1", {
		academicPeriodId: "period-1",
		courseUnitIds: ["other-department-course"],
	}, new Date("2026-11-12")), { statusCode: 422 });
});

test("rejects enrollment requests outside the administrator-configured window", async () => {
	let queriedCourses = false;
	const tx = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		academicPeriod: {
			findUnique: async () => ({
				id: "period-1",
				name: "2026/27",
				enrollmentOpensAt: new Date("2026-09-01"),
				enrollmentClosesAt: new Date("2026-11-01"),
			}),
		},
		courseUnit: { findMany: async () => { queriedCourses = true; return []; } },
	};

	await assert.rejects(createStudentEnrollmentRequests(
		{ $transaction: async (callback) => callback(tx) },
		"student-1",
		{ academicPeriodId: "period-1", courseUnitIds: ["unit-1"] },
		new Date("2026-11-12"),
	), { statusCode: 422 });
	assert.equal(queriedCourses, false);
});

test("after enrollment windows close, keeps all department courses browseable without opening enrollment", async () => {
	let courseQuery;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		academicPeriod: {
			findMany: async () => [{
				id: "period-closed",
				name: "2025/26",
				enrollmentOpensAt: new Date("2025-08-01"),
				enrollmentClosesAt: new Date("2025-10-01"),
			}],
		},
		unitEnrollment: {
			findMany: async () => [{
				courseUnitId: "unit-enrolled",
				academicPeriodId: "period-closed",
				academicPeriod: { name: "2025/26", code: "AY25" },
			}],
		},
		studentEnrollmentRequest: { findMany: async () => [] },
		courseUnit: {
			findMany: async (query) => {
				courseQuery = query;
				return [
					{
						id: "unit-enrolled",
						code: "IN101",
						name: "Computing",
						department: { id: "department-1", name: "Information Technology", initials: "IN" },
						lecturerMappings: [],
					},
					{
						id: "unit-not-enrolled",
						code: "IN102",
						name: "Networks",
						department: { id: "department-1", name: "Information Technology", initials: "IN" },
						lecturerMappings: [],
					},
				];
			},
		},
	};

	const result = await listStudentEnrollmentOptions(prisma, "student-1", new Date("2026-11-12"));

	assert.deepEqual(courseQuery.where, { department: { initials: "IN" }, course: { is: { code: "16" } } });
	assert.deepEqual(result.courses.map(({ id }) => id), ["unit-enrolled", "unit-not-enrolled"]);
	assert.deepEqual(result.academicPeriods, []);
});

test("approves assigned lecturer requests in bulk and creates matching enrollments", async () => {
	const enrollmentCreates = [];
	const requestUpdates = [];
	const studentNotifications = [];
	const requests = [{
		id: "request-1",
		studentProfileId: "student-1",
		courseUnitId: "unit-1",
		academicPeriodId: "period-1",
		courseUnit: { departmentId: "department-1", code: "IN101", department: { name: "Information Technology" } },
		student: { userId: "student-user-1" },
		academicPeriod: { name: "2026/27" },
	}];
	const tx = {
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-profile-1", unitAssignments: [{ courseUnitId: "unit-1", academicYear: "2026/27" }] }) },
		academicPeriod: { findMany: async () => [{ id: "period-1", name: "2026/27", code: "2026/27" }] },
		departmentMembership: { findMany: async () => [] },
		user: { findFirst: async () => null },
		department: { findMany: async () => [] },
		studentEnrollmentRequest: {
			findMany: async () => requests,
			updateMany: async (query) => { requestUpdates.push(query); return { count: 1 }; },
		},
		unitEnrollment: { create: async ({ data }) => { enrollmentCreates.push(data); } },
		auditLog: { create: async ({ data }) => { return data; } },
		notification: { create: async ({ data }) => { studentNotifications.push(data); } },
	};
	const db = { $transaction: async (callback) => callback(tx) };

	const result = await decideEnrollmentRequests(db, "lecturer-user-1", {
		requestIds: ["request-1"],
		decision: "APPROVE",
	});

	assert.deepEqual(result, { count: 1, status: "APPROVED" });
	assert.deepEqual(enrollmentCreates[0], { studentProfileId: "student-1", courseUnitId: "unit-1", academicPeriodId: "period-1" });
	assert.equal(requestUpdates[0].data.reviewedByUserId, "lecturer-user-1");
	assert.equal(studentNotifications[0].userId, "student-user-1");
});

test("reviewers only receive requests within their assigned scope", async () => {
	let query;
	const prisma = {
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-profile-1", unitAssignments: [{ courseUnitId: "unit-1", academicYear: "2026/27" }] }) },
		departmentMembership: { findMany: async () => [] },
		user: { findFirst: async () => null },
		department: { findMany: async () => [] },
		academicPeriod: { findMany: async () => [{ id: "period-1", name: "2026/27", code: "2026/27" }] },
		studentEnrollmentRequest: { findMany: async (args) => { query = args; return []; } },
	};

	await listEnrollmentRequestsForReviewer(prisma, "lecturer-user-1", "PENDING");

	assert.deepEqual(query.where, {
		status: "PENDING",
		OR: [{ courseUnitId: "unit-1", academicPeriodId: { in: ["period-1"] } }],
	});
});

test("COD review scope includes only currently designated departments", async () => {
	let query;
	const prisma = {
		lecturerProfile: { findFirst: async () => null },
		departmentMembership: { findMany: async () => [{ departmentId: "department-1" }, { departmentId: "department-2" }] },
		user: { findFirst: async () => ({ id: "cod-user-1" }) },
		department: { findMany: async () => [{ id: "department-1" }] },
		academicPeriod: { findMany: async () => [] },
		studentEnrollmentRequest: { findMany: async (args) => { query = args; return []; } },
	};

	await listEnrollmentRequestsForReviewer(prisma, "cod-user-1", "PENDING");

	assert.deepEqual(query.where, {
		status: "PENDING",
		OR: [{ courseUnit: { departmentId: { in: ["department-1"] } } }],
	});
});

test("prevents a reviewer from deciding requests outside their scope", async () => {
	let updated = false;
	const tx = {
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-profile-1", unitAssignments: [{ courseUnitId: "unit-2", academicYear: "2026/27" }] }) },
		departmentMembership: { findMany: async () => [] },
		user: { findFirst: async () => null },
		department: { findMany: async () => [] },
		academicPeriod: { findMany: async () => [{ id: "period-1", name: "2026/27", code: "2026/27" }] },
		studentEnrollmentRequest: {
			findMany: async () => [{
				id: "request-1",
				courseUnitId: "unit-1",
				courseUnit: { departmentId: "department-1" },
				academicPeriod: { name: "2026/27", code: "2026/27" },
			}],
			updateMany: async () => { updated = true; return { count: 1 }; },
		},
		unitEnrollment: { create: async () => { updated = true; } },
	};

	await assert.rejects(
		decideEnrollmentRequests({ $transaction: async (callback) => callback(tx) }, "lecturer-user-1", {
			requestIds: ["request-1"],
			decision: "REJECT",
		}),
		{ statusCode: 403 },
	);
	assert.equal(updated, false);
});
