import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { getStudentProfile, getStudentReportOptions, buildAcademicYearOptions, getStudentReports, getStudentReportById, submitMissingMarkReport, getStudentAttendanceHistory, submitStudentAttendanceCheckIn, getStudentNotifications, updateStudentReport, withdrawStudentReport, getStudentReportComments, submitStudentAppeal } from "../../src/modules/student/student.service.js";

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

test("lists the student's enrolled course units and periods within their department", async () => {
	let enrollmentQuery;
	const courseUnit = { id: "unit-1", code: "IN101", name: "Introduction to Computing" };
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		unitEnrollment: {
			findMany: async (query) => {
				enrollmentQuery = query;
				return [
					{ courseUnit, academicPeriod: { id: "period-2", code: "2026-T2", name: "2026 Term 2", startsAt: new Date("2026-09-01") } },
					{ courseUnit, academicPeriod: { id: "period-1", code: "2026-T1", name: "2026 Term 1", startsAt: new Date("2026-09-01") } },
				];
			},
		},
	};

	const result = await getStudentReportOptions(prisma, "user-1", new Date("2026-11-12T00:00:00Z"));

	assert.deepEqual(enrollmentQuery.where, {
		studentProfileId: "student-1",
		courseUnit: { department: { initials: "IN" }, course: { is: { code: "16" } } },
	});
	assert.deepEqual(result, [{
		...courseUnit,
		academicYears: [
			{ value: "2026/27", label: "2026/27", academicPeriodId: "period-1" },
		],
	}]);
});

test("generates academic years from 2013/14 through the current August-July year only", () => {
	const periods = [{ id: "future", startsAt: new Date("2027-09-01") }];
	const beforeAugust = buildAcademicYearOptions(periods, new Date("2026-07-31T23:59:59Z"));
	const afterAugust = buildAcademicYearOptions(periods, new Date("2026-08-01T00:00:00Z"));

	assert.deepEqual(beforeAugust, []);
	assert.equal(afterAugust.at(-1).value, "2026/27");
	assert.equal(afterAugust.some(({ value }) => value === "2027/28"), false);
	assert.equal(buildAcademicYearOptions([{ id: "period-2026", startsAt: new Date("2026-08-31T00:00:00Z") }], new Date("2026-11-13T00:00:00Z")).at(-1).academicPeriodId, "period-2026");
});

test("does not list report options when the authenticated user has no student profile", async () => {
	let enrollmentQueryCalled = false;
	const prisma = {
		studentProfile: { findUnique: async () => null },
		unitEnrollment: { findMany: async () => { enrollmentQueryCalled = true; return []; } },
	};

	await assert.rejects(getStudentReportOptions(prisma, "user-1"), { statusCode: 404 });
	assert.equal(enrollmentQueryCalled, false);
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

test("loads report details only when both report ID and student profile match", async () => {
	const report = {
		id: "report-1",
		reference: "MM-001",
		status: "Under Review",
		statusHistory: [
			{ previousStatus: null, newStatus: "Submitted", createdAt: new Date("2026-01-01T10:00:00Z") },
			{ previousStatus: "Submitted", newStatus: "Under Review", createdAt: new Date("2026-01-02T10:00:00Z") },
		],
	};
	let reportQuery;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-profile-1" }) },
		missingMarkReport: {
			findFirst: async (query) => { reportQuery = query; return report; },
		},
	};

	const result = await getStudentReportById(prisma, "user-1", "report-1");

	assert.deepEqual(reportQuery.where, { id: "report-1", studentProfileId: "student-profile-1" });
	assert.deepEqual(reportQuery.select.statusHistory, {
		select: { previousStatus: true, newStatus: true, createdAt: true },
		orderBy: { createdAt: "asc" },
	});
	assert.equal("reason" in reportQuery.select.statusHistory.select, false);
	assert.equal("actor" in reportQuery.select.statusHistory.select, false);
	assert.deepEqual(result, report);
});

test("returns the same not-found error for reports outside the student's scope", async () => {
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-profile-1" }) },
		missingMarkReport: { findFirst: async () => null },
	};
	await assert.rejects(getStudentReportById(prisma, "user-1", "other-student-report"), {
		statusCode: 404,
		message: "Missing-mark report not found.",
	});
});

test("submits an enrolled student's report with status history and audit atomically", async () => {
	const input = {
		courseUnitId: "unit-1",
		academicYear: "2026/27",
		assessmentId: "assessment-1",
		assessmentComponent: "CAT 1",
		description: "My CAT mark is missing.",
	};
	let reportData;
	const transactionCalls = [];
	const report = { id: "report-1", reference: "MM-2026-ABCDEF0123", status: "Submitted" };
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		unitEnrollment: {
			findMany: async () => [{ courseUnit: { id: "unit-1", code: "IN101", name: "Computing" }, academicPeriod: { id: "period-1", name: "2026/27", startsAt: new Date("2026-09-01") } }],
		},
		assessment: { findFirst: async () => ({ id: "assessment-1" }) },
		$transaction: async (callback) => callback({
			courseUnitLecturer: { findUnique: async () => null },
			missingMarkReport: { create: async ({ data }) => { reportData = data; return report; } },
			reportStatusHistory: { create: async ({ data }) => { transactionCalls.push({ type: "history", data }); } },
			auditLog: { create: async ({ data }) => { transactionCalls.push({ type: "audit", data }); } },
		}),
	};

	const result = await submitMissingMarkReport(prisma, "user-1", input);

	assert.equal(result, report);
	assert.equal(reportData.studentProfileId, "student-1");
	assert.equal(reportData.academicPeriodId, "period-1");
	assert.equal(reportData.status, "Submitted");
	assert.match(reportData.reference, /^MM-\d{4}-[A-F0-9]{10}$/);
	assert.equal(reportData.assessmentId, "assessment-1");
	assert.equal(transactionCalls.length, 2);
	assert.deepEqual(transactionCalls[0].data, {
		reportId: "report-1",
		actorUserId: "user-1",
		newStatus: "Submitted",
		reason: "Report submitted by student.",
	});
	assert.equal(transactionCalls[1].data.action, "REPORT_SUBMITTED");
	assert.equal(transactionCalls[1].data.entityId, "report-1");
});

test("submits a report without assessment metadata using the default component label", async () => {
	let reportData;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		unitEnrollment: { findMany: async () => [{ courseUnit: { id: "unit-1", code: "IN101", name: "Computing" }, academicPeriod: { id: "period-1", name: "2026/27", startsAt: new Date("2026-09-01") } }] },
		$transaction: async (callback) => callback({
			courseUnitLecturer: { findUnique: async () => null },
			missingMarkReport: { create: async ({ data }) => { reportData = data; return { id: "report-1" }; } },
			reportStatusHistory: { create: async () => {} },
			auditLog: { create: async () => {} },
		}),
	};

	await submitMissingMarkReport(prisma, "user-1", {
		courseUnitId: "unit-1",
		academicYear: "2026/27",
		description: "My mark is missing.",
	});

	assert.equal(reportData.assessmentComponent, "Not specified");
	assert.equal(reportData.assessmentId, undefined);
});

test("automatically assigns new reports to the lecturer owning the unit for that academic year", async () => {
	const transactionCalls = [];
	let reportData;
	const report = {
		id: "report-1",
		reference: "MM-2026-ABCDEF0123",
		courseUnit: { code: "IN101" },
	};
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		unitEnrollment: { findMany: async () => [{ courseUnit: { id: "unit-1", code: "IN101", name: "Computing" }, academicPeriod: { id: "period-1", name: "2026/27", startsAt: new Date("2026-09-01") } }] },
		$transaction: async (callback) => callback({
			courseUnitLecturer: {
				findUnique: async ({ where }) => {
					assert.deepEqual(where, { courseUnitId_academicYear: { courseUnitId: "unit-1", academicYear: "2026/27" } });
					return { lecturerProfileId: "lecturer-1", lecturer: { userId: "lecturer-user-1" } };
				},
			},
			missingMarkReport: { create: async ({ data }) => { reportData = data; return report; } },
			reportAssignment: { create: async ({ data }) => transactionCalls.push({ type: "assignment", data }) },
			reportStatusHistory: { create: async ({ data }) => transactionCalls.push({ type: "history", data }) },
			notification: { create: async ({ data }) => transactionCalls.push({ type: "notification", data }) },
			auditLog: { create: async ({ data }) => transactionCalls.push({ type: "audit", data }) },
		}),
	};

	await submitMissingMarkReport(prisma, "student-user-1", {
		courseUnitId: "unit-1",
		academicYear: "2026/27",
		description: "Missing CAT mark",
	});

	assert.equal(reportData.assignedLecturerProfileId, "lecturer-1");
	assert.equal(reportData.status, "PENDING");
	assert.equal(transactionCalls.find(({ type }) => type === "assignment").data.newLecturerProfileId, "lecturer-1");
	const notifications = transactionCalls.filter(({ type }) => type === "notification");
	assert.equal(notifications.length, 1);
	assert.equal(notifications[0].data.userId, "lecturer-user-1");
	assert.equal(notifications[0].data.title, "New missing-mark report");
	assert.equal(transactionCalls.filter(({ type }) => type === "history").length, 2);
});

test("rejects report submission when the student is not enrolled", async () => {
	let transactionStarted = false;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		unitEnrollment: { findMany: async () => [] },
		$transaction: async () => { transactionStarted = true; },
	};

	await assert.rejects(submitMissingMarkReport(prisma, "user-1", {
		courseUnitId: "unit-1",
		academicYear: "2026/27",
		assessmentComponent: "CAT 1",
		description: "Missing mark",
	}), { statusCode: 422 });
	assert.equal(transactionStarted, false);
});

test("rejects an assessment that does not belong to the selected unit", async () => {
	let transactionStarted = false;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		unitEnrollment: { findMany: async () => [{ courseUnit: { id: "unit-1", code: "IN101", name: "Computing" }, academicPeriod: { id: "period-1", name: "2026/27", startsAt: new Date("2026-09-01") } }] },
		assessment: { findFirst: async () => null },
		$transaction: async () => { transactionStarted = true; },
	};

	await assert.rejects(submitMissingMarkReport(prisma, "user-1", {
		courseUnitId: "unit-1",
		academicYear: "2026/27",
		assessmentId: "assessment-elsewhere",
		assessmentComponent: "CAT 1",
		description: "Missing mark",
	}), { statusCode: 422 });
	assert.equal(transactionStarted, false);
});

test("lists only the authenticated student's attendance history with corrections and pagination", async () => {
	const records = [{ id: "history-1", courseUnitCode: "UNIT101", status: "Present" }];
	let historyQuery;
	let countQuery;
	const prisma = {
		studentProfile: {
			findUnique: async ({ where }) => {
				assert.deepEqual(where, { userId: "user-1" });
				return { id: "student-1" };
			},
		},
		attendanceHistory: {
			findMany: async (query) => { historyQuery = query; return records; },
			count: async (query) => { countQuery = query; return 12; },
		},
		$transaction: async (operations) => Promise.all(operations),
	};

	const result = await getStudentAttendanceHistory(prisma, "user-1", { page: 2, limit: 5 });

	assert.deepEqual(historyQuery.where, { studentProfileId: "student-1" });
	assert.deepEqual(countQuery.where, historyQuery.where);
	assert.equal(historyQuery.skip, 5);
	assert.equal(historyQuery.take, 5);
	assert.deepEqual(historyQuery.orderBy, { signedAt: "desc" });
	assert.deepEqual(historyQuery.select.attendanceRecord.select.session.select, {
		sessionType: true,
	});
	assert.ok(historyQuery.select.attendanceRecord.select.corrections);
	assert.deepEqual(result.records, records);
	assert.deepEqual(result.pagination, { page: 2, limit: 5, total: 12, totalPages: 3 });
});

test("does not query attendance history when no student profile exists", async () => {
	let historyQueryCalled = false;
	const prisma = {
		studentProfile: { findUnique: async () => null },
		attendanceHistory: {
			findMany: async () => { historyQueryCalled = true; return []; },
			count: async () => { historyQueryCalled = true; return 0; },
		},
		$transaction: async (operations) => Promise.all(operations),
	};

	await assert.rejects(getStudentAttendanceHistory(prisma, "user-1"), { statusCode: 404 });
	assert.equal(historyQueryCalled, false);
});

function createCheckInPrisma(overrides = {}) {
	const state = { attempts: [], records: [], histories: [] };
	const session = {
		id: "session-1",
		status: "active",
		startsAt: new Date("2026-11-13T06:00:00.000Z"),
		endsAt: new Date("2026-11-13T08:00:00.000Z"),
		sessionType: "CLASS",
		courseUnit: {
			id: "unit-1",
			code: "IN101",
			name: "Computing",
			department: { initials: "IN" },
			course: { code: "16" },
		},
		classroom: { name: "Room 1", latitude: -1.286389, longitude: 36.817223, boundaryMeters: 80, isActive: true },
		...overrides.session,
	};
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1", studentNumber: "IN16/01234/26" }) },
		attendanceSession: {
			findUnique: async ({ where }) => {
				assert.equal(where.accessTokenHash, createHash("sha256").update("a".repeat(64)).digest("hex"));
				return session;
			},
		},
		unitEnrollment: {
			findMany: async () => [{ academicPeriod: { startsAt: new Date("2026-08-01"), code: "2026-T1", name: "2026 Term 1" } }],
		},
		attendanceAttempt: { create: async ({ data }) => state.attempts.push(data) },
		attendanceRecord: { findUnique: async () => null },
		$transaction: async (callback) => callback({
			attendanceRecord: {
				create: async ({ data }) => {
					state.records.push(data);
					return { id: "record-1", ...data };
				},
			},
			attendanceHistory: {
				create: async ({ data }) => { state.histories.push(data); },
			},
		}),
		...overrides.prisma,
	};
	return { prisma, session, state };
}

test("records a student attendance check-in only after active-session, enrollment, and GPS checks", async () => {
	const { prisma, state } = createCheckInPrisma();
	const now = new Date("2026-11-13T07:00:00.000Z");
	const result = await submitStudentAttendanceCheckIn(prisma, "user-1", {
		token: "a".repeat(64),
		latitude: -1.286389,
		longitude: 36.817223,
		accuracyMeters: 8,
	}, now);

	assert.equal(result.record.id, "record-1");
	assert.equal(result.record.locationVerified, true);
	assert.equal(state.records.length, 1);
	assert.equal(state.records[0].status, "PRESENT");
	assert.equal(state.histories[0].attendanceRecordId, "record-1");
	assert.equal(state.histories[0].courseUnitCode, "IN101");
	assert.equal(state.attempts.length, 0);
});

test("rejects check-ins outside the configured boundary and records a rejected attempt", async () => {
	const { prisma, state } = createCheckInPrisma();
	await assert.rejects(submitStudentAttendanceCheckIn(prisma, "user-1", {
		token: "a".repeat(64),
		latitude: -1.30,
		longitude: 36.817223,
		accuracyMeters: 8,
	}, new Date("2026-11-13T07:00:00.000Z")), {
		statusCode: 403,
		message: "Your device location is outside the configured classroom boundary",
	});

	assert.deepEqual(state.attempts, [{
		sessionId: "session-1",
		studentProfileId: "student-1",
		outcome: "REJECTED",
		failureReason: "OUTSIDE_CLASSROOM",
	}]);
	assert.equal(state.records.length, 0);
});

test("validates coarse GPS readings through the location check instead of request validation", async () => {
	const { prisma, state } = createCheckInPrisma();
	await assert.rejects(submitStudentAttendanceCheckIn(prisma, "user-1", {
		token: "a".repeat(64),
		latitude: -1.286389,
		longitude: 36.817223,
		accuracyMeters: 6000,
	}, new Date("2026-11-13T07:00:00.000Z")), {
		statusCode: 403,
		message: "Your location is too close to the boundary to verify attendance. Move closer to the classroom and try again",
	});

	assert.equal(state.attempts[0].failureReason, "LOCATION_ACCURACY_INSUFFICIENT");
	assert.equal(state.records.length, 0);
});

test("rejects students who are not enrolled in the session course unit", async () => {
	const enrollmentLookup = async ({ where }) => {
		assert.deepEqual(where, { studentProfileId: "student-1", courseUnitId: "unit-1" });
		return [];
	};
	const { prisma } = createCheckInPrisma({
		prisma: { unitEnrollment: { findMany: enrollmentLookup } },
	});
	await assert.rejects(submitStudentAttendanceCheckIn(prisma, "user-1", {
		token: "a".repeat(64),
		latitude: -1.286389,
		longitude: 36.817223,
		accuracyMeters: 8,
	}, new Date("2026-11-13T07:00:00.000Z")), {
		statusCode: 403,
		message: "You are not enrolled in this course unit for the session's academic year",
	});
});

test("rejects check-ins for a course unit outside the student's registered course", async () => {
	let enrollmentLookupCalled = false;
	const { prisma, state } = createCheckInPrisma({
		session: {
			courseUnit: {
				id: "unit-1",
				code: "CB101",
				name: "Business",
				department: { initials: "CB" },
				course: { code: "16" },
			},
		},
		prisma: {
			unitEnrollment: {
				findMany: async () => {
					enrollmentLookupCalled = true;
					return [{ academicPeriod: { startsAt: new Date("2026-08-01"), code: "2026-T1", name: "2026 Term 1" } }];
				},
			},
		},
	});

	await assert.rejects(submitStudentAttendanceCheckIn(prisma, "user-1", {
		token: "a".repeat(64),
		latitude: -1.286389,
		longitude: 36.817223,
		accuracyMeters: 8,
	}, new Date("2026-11-13T07:00:00.000Z")), {
		statusCode: 403,
		message: "This course unit is not part of your registered course",
	});
	assert.equal(enrollmentLookupCalled, false);
	assert.equal(state.records.length, 0);
});

test("rejects enrollment in the course unit when it is for a different academic year", async () => {
	const { prisma, state } = createCheckInPrisma({
		prisma: {
			unitEnrollment: {
				findMany: async ({ where }) => {
					assert.deepEqual(where, { studentProfileId: "student-1", courseUnitId: "unit-1" });
					return [{
						academicPeriod: {
							startsAt: new Date("2025-08-01"),
							code: "2025-T1",
							name: "2025 Term 1",
						},
					}];
				},
			},
		},
	});

	await assert.rejects(submitStudentAttendanceCheckIn(prisma, "user-1", {
		token: "a".repeat(64),
		latitude: -1.286389,
		longitude: 36.817223,
		accuracyMeters: 8,
	}, new Date("2026-11-13T07:00:00.000Z")), {
		statusCode: 403,
		message: "You are not enrolled in this course unit for the session's academic year",
	});
	assert.equal(state.records.length, 0);
});

test("rejects a QR check-in after its scheduled end time", async () => {
	const { prisma } = createCheckInPrisma({
		session: { endsAt: new Date("2026-11-13T06:59:00.000Z") },
	});
	await assert.rejects(submitStudentAttendanceCheckIn(prisma, "user-1", {
		token: "a".repeat(64),
		latitude: -1.286389,
		longitude: 36.817223,
		accuracyMeters: 8,
	}, new Date("2026-11-13T07:00:00.000Z")), {
		statusCode: 409,
		message: "This attendance session is not currently accepting check-ins",
	});
});

test("updates a submitted report only when it belongs to the student and is still editable", async () => {
	const report = {
		id: "report-1",
		studentProfileId: "student-1",
		courseUnitId: "unit-1",
		assessmentId: "assessment-1",
		assessmentComponent: "CAT 1",
		description: "Old text",
		status: "Submitted",
	};
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		missingMarkReport: {
			findUnique: async () => report,
		},
		assessment: {
			findFirst: async () => ({ id: "assessment-1", courseUnitId: "unit-1" }),
		},
		$transaction: async (callback) => callback({
			missingMarkReport: {
				updateMany: async () => ({ count: 1 }),
				findUnique: async ({ where }) => ({ ...report, ...where, assessmentComponent: "CAT 2", description: "Updated explanation" }),
			},
			reportStatusHistory: {
				create: async () => ({ id: "history-1" }),
			},
		}),
	};

	const result = await updateStudentReport(prisma, "user-1", "report-1", {
		assessmentComponent: "CAT 2",
		description: "Updated explanation",
	});

	assert.equal(result.assessmentComponent, "CAT 2");
	assert.equal(result.description, "Updated explanation");
	assert.equal(result.status, "Submitted");
});

test("rejects report updates once the report is no longer in the editable submitted state", async () => {
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		missingMarkReport: {
			findUnique: async () => ({ id: "report-1", studentProfileId: "student-1", status: "Under Review" }),
		},
	};

	await assert.rejects(updateStudentReport(prisma, "user-1", "report-1", { description: "Nope" }), {
		statusCode: 409,
		message: "Report can only be edited while it is still in Submitted state.",
	});
});

test("withdraws a submitted report and records a status transition", async () => {
	const report = {
		id: "report-1",
		studentProfileId: "student-1",
		status: "Submitted",
	};
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		missingMarkReport: {
			findUnique: async () => report,
		},
		$transaction: async (callback) => callback({
			missingMarkReport: {
				updateMany: async () => ({ count: 1 }),
			},
			reportStatusHistory: {
				create: async ({ data }) => data,
			},
		}),
	};

	const result = await withdrawStudentReport(prisma, "user-1", "report-1");
	assert.equal(result.status, "Withdrawn");
});

test("lists only the authenticated user's notifications with pagination and unread count", async () => {
	const notifications = [{ id: "notice-1", title: "Report update", readAt: null }];
	const notificationQueries = [];
	const prisma = {
		notification: {
			findMany: async (query) => { notificationQueries.push(query); return notifications; },
			count: async (query) => { notificationQueries.push(query); return query.where.readAt === null ? 2 : 8; },
		},
		$transaction: async (operations) => Promise.all(operations),
	};

	const result = await getStudentNotifications(prisma, "user-1", { page: 2, limit: 3 });

	assert.deepEqual(notificationQueries[0].where, { userId: "user-1" });
	assert.equal(notificationQueries[0].skip, 3);
	assert.equal(notificationQueries[0].take, 3);
	assert.deepEqual(notificationQueries[0].orderBy, { createdAt: "desc" });
	assert.deepEqual(notificationQueries[1].where, { userId: "user-1" });
	assert.deepEqual(notificationQueries[2].where, { userId: "user-1", readAt: null });
	assert.deepEqual(result.notifications, notifications);
	assert.equal(result.unreadCount, 2);
	assert.deepEqual(result.pagination, { page: 2, limit: 3, total: 8, totalPages: 3 });
});

test("returns comments for only the authenticated student's own report and normalizes author roles", async () => {
	const report = { id: "report-1", studentProfileId: "student-1" };
	const comments = [{
		id: "comment-1",
		body: "Please confirm the CAT schedule.",
		createdAt: new Date("2026-02-01T09:00:00Z"),
		author: {
			id: "user-2",
			displayName: "Dr. Ncube",
			roles: [{ role: { name: "lecturer" } }],
		},
	}];
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		missingMarkReport: { findFirst: async ({ where }) => {
			assert.deepEqual(where, { id: "report-1", studentProfileId: "student-1" });
			return report;
		} },
		reportComment: {
			findMany: async ({ where }) => {
				assert.deepEqual(where, {
					reportId: "report-1",
					OR: [{ isStudentVisible: true }, { authorUserId: "user-1" }],
				});
				return comments;
			},
		},
	};

	const result = await getStudentReportComments(prisma, "user-1", "report-1");

	assert.equal(result.length, 1);
	assert.deepEqual(result[0].author.roles, ["lecturer"]);
	assert.equal(result[0].body, "Please confirm the CAT schedule.");
});

test("rejects an appeal when the report does not belong to the student or is not in a final state", async () => {
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		$transaction: async (callback) => callback({
			$queryRaw: async () => [],
			missingMarkReport: { findFirst: async () => null },
		}),
	};

	await assert.rejects(submitStudentAppeal(prisma, "user-1", "report-1", { reason: "I need a review." }), {
		statusCode: 404,
		message: "Missing-mark report not found.",
	});

	const reviewPrisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		$transaction: async (callback) => callback({
			$queryRaw: async () => [{ id: "report-1" }],
			missingMarkReport: { findFirst: async () => ({ id: "report-1", studentProfileId: "student-1", status: "Submitted", courseUnit: { department: { id: "dept-1", designatedCodUserId: "cod-1" } } }) },
		}),
	};

	await assert.rejects(submitStudentAppeal(reviewPrisma, "user-1", "report-1", { reason: "I need a review." }), {
		statusCode: 409,
		message: "Appeals are only allowed after a report is rejected.",
	});
});

test("submits a single appeal for a finalised report and stores the status history in the appeal record", async () => {
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		$transaction: async (callback) => callback({
			$queryRaw: async () => [{ id: "report-1" }],
			missingMarkReport: {
				findFirst: async () => ({ id: "report-1", studentProfileId: "student-1", status: "REJECTED", courseUnit: { department: { id: "dept-1", designatedCodUserId: "cod-1" } } }),
			},
			user: { findFirst: async () => ({ id: "cod-1" }) },
			reportStatusHistory: { findFirst: async () => ({ createdAt: new Date() }) },
			publicHoliday: { findMany: async () => [] },
			appeal: {
				findFirst: async () => null,
				create: async ({ data }) => ({ id: "appeal-1", ...data }),
			},
			notificationOutbox: { create: async () => ({ id: "event-1" }) },
			auditLog: { create: async () => ({ id: "audit-1" }) },
		}),
	};

	const result = await submitStudentAppeal(prisma, "user-1", "report-1", { reason: "I was not given enough time to submit my CAT." });

	assert.equal(result.status, "Submitted");
	assert.equal(result.reportId, "report-1");
	assert.equal(result.studentProfileId, "student-1");
	assert.equal(result.reason, "I was not given enough time to submit my CAT.");
});

test("rejects a second appeal for the same report", async () => {
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		$transaction: async (callback) => callback({
			$queryRaw: async () => [{ id: "report-1" }],
			missingMarkReport: { findFirst: async () => ({ id: "report-1", studentProfileId: "student-1", status: "REJECTED", courseUnit: { department: { id: "dept-1", designatedCodUserId: "cod-1" } } }) },
			user: { findFirst: async () => ({ id: "cod-1" }) },
			reportStatusHistory: { findFirst: async () => ({ createdAt: new Date() }) },
			publicHoliday: { findMany: async () => [] },
			appeal: { findFirst: async () => ({ id: "appeal-1" }) },
		}),
	};

	await assert.rejects(submitStudentAppeal(prisma, "user-1", "report-1", { reason: "Second attempt." }), {
		statusCode: 409,
		message: "A report can have at most one appeal submitted.",
	});
});

test("appeal without a valid designated COD creates neither appeal nor outbox event", async () => {
	let appealCreates = 0;
	let eventCreates = 0;
	const prisma = {
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		$transaction: async (callback) => callback({
			$queryRaw: async () => [{ id: "report-1" }],
			missingMarkReport: { findFirst: async () => ({ id: "report-1", studentProfileId: "student-1", status: "REJECTED", courseUnit: { department: { id: "dept-1", designatedCodUserId: "inactive-cod" } } }) },
			user: { findFirst: async () => null },
			appeal: { create: async () => { appealCreates += 1; } },
			notificationOutbox: { create: async () => { eventCreates += 1; } },
		}),
	};
	await assert.rejects(submitStudentAppeal(prisma, "user-1", "report-1", { reason: "Please review." }), {
		statusCode: 409,
		message: "This department currently has no valid designated COD, so the submission cannot proceed.",
	});
	assert.equal(appealCreates, 0);
	assert.equal(eventCreates, 0);
});
