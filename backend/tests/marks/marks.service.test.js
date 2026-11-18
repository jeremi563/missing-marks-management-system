import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const {
	decideCodMarkCorrection,
	getAssessmentRoster,
	getStudentMarks,
	submitInitialMarks,
	submitMarkCorrection,
} = await import("../../src/modules/marks/marks.service.js");

const period = { id: "period-1", name: "Semester 1", code: "S1", startsAt: new Date("2026-09-01T00:00:00.000Z"), endsAt: new Date("2027-01-01T00:00:00.000Z") };

function initialDb({
	enrollments = [{ id: "enrollment-1", studentProfileId: "student-1" }],
	attendanceRecords = [{
		studentProfileId: "student-1",
		status: "PRESENT",
		examVerificationStatus: null,
		recordedAt: new Date("2026-10-12T10:00:00.000Z"),
	}],
	assessmentType = "CAT",
	createError,
} = {}) {
	const calls = { created: [], audits: [], assignment: null, attendanceQuery: null };
	const tx = {
		lecturerProfile: {
			findFirst: async () => ({ id: "lecturer-1" }),
		},
		assessment: {
			findUnique: async () => ({ id: "assessment-1", courseUnitId: "unit-1", type: assessmentType, maximumMarks: 100 }),
		},
		academicPeriod: {
			findUnique: async () => period,
		},
		courseUnitLecturer: {
			findFirst: async ({ where }) => { calls.assignment = where; return { id: "assignment-1" }; },
		},
		unitEnrollment: {
			findMany: async () => enrollments,
		},
		attendanceRecord: {
			findMany: async (args) => {
				calls.attendanceQuery = args;
				return attendanceRecords;
			},
		},
		studentMark: {
			create: async ({ data }) => {
				if (createError) throw createError;
				calls.created.push(data);
				return { id: `mark-${calls.created.length}`, ...data, version: 1, createdAt: new Date(), updatedAt: new Date() };
			},
		},
		auditLog: {
			create: async ({ data }) => { calls.audits.push(data); return data; },
		},
	};
	return {
		calls,
		db: { ...tx, $transaction: async (callback) => callback(tx) },
	};
}

test("initial mark submission validates the academic-year assignment and records official marks", async () => {
	const { db, calls } = initialDb();
	const result = await submitInitialMarks({
		db,
		userId: "lecturer-user",
		assessmentId: "assessment-1",
		academicPeriodId: period.id,
		marks: [{ studentProfileId: "student-1", value: 87 }],
	});

	assert.equal(result.created.length, 1);
	assert.equal(calls.created[0].enteredByLecturerId, "lecturer-1");
	assert.equal(calls.created[0].value, 87);
	assert.equal(calls.assignment.academicYear, "2026/27");
	assert.equal(calls.audits[0].action, "LECTURER_INITIAL_MARK_SUBMITTED");
	assert.equal(calls.audits[0].metadata.finalValue, 87);
	assert.deepEqual(calls.attendanceQuery.where.session.is, {
		assessmentId: "assessment-1",
		courseUnitId: "unit-1",
		sessionType: "CAT",
		startsAt: { gte: period.startsAt, lte: period.endsAt },
	});
});

test("initial marks reject values above the assessment maximum", async () => {
	const { db, calls } = initialDb();
	await assert.rejects(
		() => submitInitialMarks({
			db,
			userId: "lecturer-user",
			assessmentId: "assessment-1",
			academicPeriodId: period.id,
			marks: [{ studentProfileId: "student-1", value: 101 }],
		}),
		{ statusCode: 400 },
	);
	assert.equal(calls.created.length, 0);
});

test("initial marks require recorded present attendance and verified exam attendance", async () => {
	const { db: absentDb, calls: absentCalls } = initialDb({
		attendanceRecords: [{
			studentProfileId: "student-1",
			status: "ABSENT",
			examVerificationStatus: null,
			recordedAt: new Date("2026-10-12T10:00:00.000Z"),
		}],
	});
	await assert.rejects(
		() => submitInitialMarks({
			db: absentDb,
			userId: "lecturer-user",
			assessmentId: "assessment-1",
			academicPeriodId: period.id,
			marks: [{ studentProfileId: "student-1", value: 20 }],
		}),
		{ statusCode: 422 },
	);
	assert.equal(absentCalls.created.length, 0);

	const examAttendance = {
		studentProfileId: "student-1",
		status: "PRESENT",
		examVerificationStatus: "PENDING_REVIEW",
		recordedAt: new Date("2026-10-12T10:00:00.000Z"),
	};
	const { db: pendingExamDb, calls: pendingExamCalls } = initialDb({
		assessmentType: "EXAM",
		attendanceRecords: [examAttendance],
	});
	await assert.rejects(
		() => submitInitialMarks({
			db: pendingExamDb,
			userId: "lecturer-user",
			assessmentId: "assessment-1",
			academicPeriodId: period.id,
			marks: [{ studentProfileId: "student-1", value: 20 }],
		}),
		{ statusCode: 422 },
	);
	assert.equal(pendingExamCalls.created.length, 0);

	const { db: verifiedExamDb, calls: verifiedExamCalls } = initialDb({
		assessmentType: "EXAM",
		attendanceRecords: [{ ...examAttendance, examVerificationStatus: "VERIFIED", locationVerified: false }],
	});
	const result = await submitInitialMarks({
		db: verifiedExamDb,
		userId: "lecturer-user",
		assessmentId: "assessment-1",
		academicPeriodId: period.id,
		marks: [{ studentProfileId: "student-1", value: 20 }],
	});
	assert.equal(result.created.length, 1);
	assert.equal(verifiedExamCalls.created.length, 1);
});

test("assessment rosters identify students with no eligible attendance as incomplete", async () => {
	const { db, calls } = initialDb({
		enrollments: [
			{
				id: "enrollment-1",
				studentProfileId: "student-1",
				student: { id: "student-1", studentNumber: "CS/00001/26", user: { displayName: "Alex" } },
				marks: [],
			},
			{
				id: "enrollment-2",
				studentProfileId: "student-2",
				student: { id: "student-2", studentNumber: "CS/00002/26", user: { displayName: "Sam" } },
				marks: [],
			},
		],
		attendanceRecords: [{
			studentProfileId: "student-1",
			status: "LATE",
			examVerificationStatus: null,
			recordedAt: new Date("2026-10-12T10:00:00.000Z"),
		}, {
			studentProfileId: "student-2",
			status: "ABSENT",
			examVerificationStatus: null,
			recordedAt: new Date("2026-10-12T10:00:00.000Z"),
		}],
	});
	const result = await getAssessmentRoster({
		db,
		userId: "lecturer-user",
		assessmentId: "assessment-1",
		academicPeriodId: period.id,
	});

	assert.equal(result.students[0].attendance.eligible, true);
	assert.equal(result.students[0].attendance.status, "LATE");
	assert.equal(result.students[1].attendance.eligible, false);
	assert.equal(result.students[1].attendance.status, "ABSENT");
	assert.equal(calls.attendanceQuery.where.studentProfileId.in.length, 2);
});

test("initial mark submission rejects decimal values in the service layer", async () => {
	const { db, calls } = initialDb();
	await assert.rejects(
		() => submitInitialMarks({
			db,
			userId: "lecturer-user",
			assessmentId: "assessment-1",
			academicPeriodId: period.id,
			marks: [{ studentProfileId: "student-1", value: 20.5 }],
		}),
		{ statusCode: 400, message: "Marks must be nonnegative whole numbers" },
	);
	assert.equal(calls.created.length, 0);
});

test("initial submission rejects students without enrollment and never overwrites a duplicate", async () => {
	const { db: unenrolledDb, calls: unenrolledCalls } = initialDb({ enrollments: [] });
	await assert.rejects(
		() => submitInitialMarks({
			db: unenrolledDb,
			userId: "lecturer-user",
			assessmentId: "assessment-1",
			academicPeriodId: period.id,
			marks: [{ studentProfileId: "student-1", value: 20 }],
		}),
		{ statusCode: 422 },
	);
	assert.equal(unenrolledCalls.created.length, 0);

	const { db: duplicateDb } = initialDb({ createError: { code: "P2002" } });
	await assert.rejects(
		() => submitInitialMarks({
			db: duplicateDb,
			userId: "lecturer-user",
			assessmentId: "assessment-1",
			academicPeriodId: period.id,
			marks: [{ studentProfileId: "student-1", value: 20 }],
		}),
		{ statusCode: 409 },
	);
});

function correctionDb({
	mark = { id: "mark-1", value: 60, version: 4 },
	pending = null,
	createError,
	assessmentType = "CAT",
	attendanceRecords = [{
		studentProfileId: "student-1",
		status: "PRESENT",
		examVerificationStatus: assessmentType === "EXAM" ? "VERIFIED" : null,
		recordedAt: new Date("2026-10-12T10:00:00.000Z"),
	}],
} = {}) {
	const calls = { create: null, audits: [], outbox: [] };
	const report = {
		id: "report-1",
		reference: "MM-001",
		status: "APPROVED",
		studentProfileId: "student-1",
		courseUnitId: "unit-1",
		academicPeriodId: period.id,
		assessmentId: "assessment-1",
		academicPeriod: period,
		courseUnit: { departmentId: "department-1", department: { designatedCodUserId: "cod-user" } },
		assessment: { id: "assessment-1", courseUnitId: "unit-1", type: assessmentType, maximumMarks: 100 },
	};
	const tx = {
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-1" }) },
		missingMarkReport: { findFirst: async () => report },
		courseUnitLecturer: { findFirst: async () => ({ id: "assignment-1" }) },
		unitEnrollment: { findUnique: async () => ({ id: "enrollment-1" }) },
		attendanceRecord: { findMany: async () => attendanceRecords },
		markCorrection: {
			findFirst: async () => pending,
			create: async ({ data }) => {
				if (createError) throw createError;
				calls.create = data;
				return { id: "correction-1", ...data, createdAt: new Date() };
			},
		},
		studentMark: { findUnique: async () => mark },
		departmentMembership: { findMany: async () => [{ departmentId: "department-1" }] },
		user: { findFirst: async () => ({ id: "cod-user" }) },
		department: { findMany: async () => [{ id: "department-1" }] },
		auditLog: { create: async ({ data }) => { calls.audits.push(data); return data; } },
		notificationOutbox: { create: async ({ data }) => { calls.outbox.push(data); return data; } },
	};
	return { calls, db: { ...tx, $transaction: async (callback) => callback(tx) } };
}

test("correction proposals capture the official mark value and version", async () => {
	const { db, calls } = correctionDb();
	const result = await submitMarkCorrection({
		db,
		userId: "lecturer-user",
		reportId: "report-1",
		proposedValue: 75,
		reason: "Verified against the signed script.",
	});
	assert.equal(result.originalValue, 60);
	assert.equal(calls.create.markId, "mark-1");
	assert.equal(calls.create.baseMarkVersion, 4);
	assert.equal(calls.create.baselineVerified, true);
	assert.equal(calls.audits[0].action, "LECTURER_MARK_CORRECTION_SUBMITTED");
	assert.equal(calls.outbox.length, 1);
});

test("correction proposals record a verified no-mark baseline and reject a pending duplicate", async () => {
	const { db, calls } = correctionDb({ mark: null });
	await submitMarkCorrection({
		db,
		userId: "lecturer-user",
		reportId: "report-1",
		proposedValue: 75,
		reason: "The result was missing.",
	});
	assert.equal(calls.create.markId, null);
	assert.equal(calls.create.originalValue, null);
	assert.equal(calls.create.baseMarkVersion, null);
	assert.equal(calls.create.baselineVerified, true);

	const { db: pendingDb } = correctionDb({ pending: { id: "existing-correction" } });
	await assert.rejects(
		() => submitMarkCorrection({
			db: pendingDb,
			userId: "lecturer-user",
			reportId: "report-1",
			proposedValue: 75,
			reason: "Duplicate.",
		}),
		{ statusCode: 409 },
	);
	const { db: concurrentDb } = correctionDb({ createError: { code: "P2002" } });
	await assert.rejects(
		() => submitMarkCorrection({
			db: concurrentDb,
			userId: "lecturer-user",
			reportId: "report-1",
			proposedValue: 75,
			reason: "Concurrent proposal.",
		}),
		{ statusCode: 409 },
	);
});

test("correction proposals require eligible attendance and a whole-number mark", async () => {
	const { db: decimalDb, calls: decimalCalls } = correctionDb();
	await assert.rejects(
		() => submitMarkCorrection({
			db: decimalDb,
			userId: "lecturer-user",
			reportId: "report-1",
			proposedValue: 75.5,
			reason: "Fractional proposal.",
		}),
		{ statusCode: 400 },
	);
	assert.equal(decimalCalls.create, null);

	const { db: absentDb, calls: absentCalls } = correctionDb({
		attendanceRecords: [{
			studentProfileId: "student-1",
			status: "ABSENT",
			examVerificationStatus: null,
			recordedAt: new Date("2026-10-12T10:00:00.000Z"),
		}],
	});
	await assert.rejects(
		() => submitMarkCorrection({
			db: absentDb,
			userId: "lecturer-user",
			reportId: "report-1",
			proposedValue: 75,
			reason: "No recorded attendance.",
		}),
		{ statusCode: 422 },
	);
	assert.equal(absentCalls.create, null);

	const { db: pendingExamDb, calls: pendingExamCalls } = correctionDb({
		assessmentType: "EXAM",
		attendanceRecords: [{
			studentProfileId: "student-1",
			status: "PRESENT",
			examVerificationStatus: "PENDING_REVIEW",
			recordedAt: new Date("2026-10-12T10:00:00.000Z"),
		}],
	});
	await assert.rejects(
		() => submitMarkCorrection({
			db: pendingExamDb,
			userId: "lecturer-user",
			reportId: "report-1",
			proposedValue: 75,
			reason: "Exam verification is pending.",
		}),
		{ statusCode: 422 },
	);
	assert.equal(pendingExamCalls.create, null);
});

const correctionForDecision = ({
	markId = "mark-1",
	baselineVerified = true,
	status = "PENDING_REVIEW",
	assessmentType = "CAT",
} = {}) => ({
	id: "correction-1",
	reportId: "report-1",
	markId,
	proposedByLecturerId: "lecturer-1",
	originalValue: markId ? 60 : null,
	proposedValue: 75,
	finalValue: null,
	baseMarkVersion: markId ? 4 : null,
	baselineVerified,
	status,
	reason: "Verified correction",
	report: {
		id: "report-1",
		reference: "MM-001",
		studentProfileId: "student-1",
		courseUnitId: "unit-1",
		academicPeriodId: period.id,
		assessmentId: "assessment-1",
		student: { user: { id: "student-user" } },
		courseUnit: { departmentId: "department-1" },
		academicPeriod: period,
		assessment: { id: "assessment-1", courseUnitId: "unit-1", type: assessmentType, maximumMarks: 100 },
	},
	proposedBy: { user: { id: "lecturer-user" } },
});

function decisionDb({
	correction = correctionForDecision(),
	currentMark = { id: "mark-1", value: 60, version: 4, unitEnrollmentId: "enrollment-1", assessmentId: "assessment-1" },
	markUpdateCount = 1,
	departmentAuthorized = true,
	attendanceRecords = [{
		studentProfileId: "student-1",
		status: "PRESENT",
		examVerificationStatus: "VERIFIED",
		recordedAt: new Date("2026-10-12T10:00:00.000Z"),
	}],
} = {}) {
	const calls = { markUpdate: null, markCreate: null, correctionUpdate: null, audits: [], outbox: [] };
	const tx = {
		markCorrection: {
			findUnique: async () => correction,
			updateMany: async ({ where, data }) => { calls.correctionUpdate = { where, data }; return { count: 1 }; },
		},
		departmentMembership: { findMany: async () => departmentAuthorized ? [{ departmentId: "department-1" }] : [] },
		user: { findFirst: async () => departmentAuthorized ? ({ id: "cod-user" }) : null },
		department: { findMany: async () => departmentAuthorized ? [{ id: "department-1" }] : [] },
		unitEnrollment: { findUnique: async () => ({ id: "enrollment-1" }) },
		attendanceRecord: { findMany: async () => attendanceRecords },
		studentMark: {
			findUnique: async () => currentMark,
			updateMany: async ({ where, data }) => { calls.markUpdate = { where, data }; return { count: markUpdateCount }; },
			create: async ({ data }) => { calls.markCreate = data; return { id: "new-mark-1" }; },
		},
		auditLog: { create: async ({ data }) => { calls.audits.push(data); return data; } },
		notificationOutbox: { create: async ({ data }) => { calls.outbox.push(data); return data; } },
	};
	return { calls, db: { ...tx, $transaction: async (callback) => callback(tx) } };
}

test("COD approval updates an existing mark optimistically and records final history", async () => {
	const { db, calls } = decisionDb();
	const result = await decideCodMarkCorrection({ db, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" });
	assert.equal(result.status, "APPROVED");
	assert.equal(calls.markUpdate.data.value, 75);
	assert.deepEqual(calls.markUpdate.data.version, { increment: 1 });
	assert.equal(calls.correctionUpdate.data.finalValue, 75);
	assert.equal(calls.correctionUpdate.data.reviewedByUserId, "cod-user");
	assert.equal(calls.audits[0].metadata.originalValue, 60);
	assert.equal(calls.audits[0].metadata.finalValue, 75);
	assert.equal(calls.outbox.length, 2);
});

test("COD approval creates a missing mark but refuses stale, legacy and unauthorized decisions", async () => {
	const missingCorrection = correctionForDecision({ markId: null });
	const { db: missingDb, calls: missingCalls } = decisionDb({ correction: missingCorrection, currentMark: null });
	const result = await decideCodMarkCorrection({ db: missingDb, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" });
	assert.equal(result.markId, "new-mark-1");
	assert.equal(missingCalls.markCreate.enteredByLecturerId, "lecturer-1");

	const { db: staleDb, calls: staleCalls } = decisionDb({ markUpdateCount: 0 });
	await assert.rejects(
		() => decideCodMarkCorrection({ db: staleDb, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" }),
		{ statusCode: 409 },
	);
	assert.equal(staleCalls.correctionUpdate, null);
	assert.equal(staleCalls.audits.length, 0);

	const legacy = correctionForDecision({ baselineVerified: false });
	const { db: legacyDb } = decisionDb({ correction: legacy });
	await assert.rejects(
		() => decideCodMarkCorrection({ db: legacyDb, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" }),
		{ statusCode: 409 },
	);

	const { db: unauthorizedDb } = decisionDb({ departmentAuthorized: false });
	await assert.rejects(
		() => decideCodMarkCorrection({ db: unauthorizedDb, userId: "not-cod", correctionId: "correction-1", decision: "REJECT", comments: "Not authorized" }),
		{ statusCode: 403 },
	);

	const selfReviewed = correctionForDecision();
	selfReviewed.proposedBy.user.id = "cod-user";
	const { db: selfReviewDb } = decisionDb({ correction: selfReviewed });
	const selfReview = await decideCodMarkCorrection({ db: selfReviewDb, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" });
	assert.equal(selfReview.status, "APPROVED");
});

test("COD approval requires eligible attendance and a whole-number proposal", async () => {
	const correction = correctionForDecision();
	const { db: absentDb, calls: absentCalls } = decisionDb({
		correction,
		attendanceRecords: [{
			studentProfileId: "student-1",
			status: "ABSENT",
			examVerificationStatus: null,
			recordedAt: new Date("2026-10-12T10:00:00.000Z"),
		}],
	});
	await assert.rejects(
		() => decideCodMarkCorrection({ db: absentDb, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" }),
		{ statusCode: 422 },
	);
	assert.equal(absentCalls.markUpdate, null);
	assert.equal(absentCalls.markCreate, null);

	const pendingExam = correctionForDecision({ assessmentType: "EXAM" });
	const { db: pendingExamDb, calls: pendingExamCalls } = decisionDb({
		correction: pendingExam,
		attendanceRecords: [{
			studentProfileId: "student-1",
			status: "PRESENT",
			examVerificationStatus: "PENDING_REVIEW",
			recordedAt: new Date("2026-10-12T10:00:00.000Z"),
		}],
	});
	await assert.rejects(
		() => decideCodMarkCorrection({ db: pendingExamDb, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" }),
		{ statusCode: 422 },
	);
	assert.equal(pendingExamCalls.markUpdate, null);
	assert.equal(pendingExamCalls.markCreate, null);

	const fractional = correctionForDecision();
	fractional.proposedValue = 75.5;
	const { db: fractionalDb, calls: fractionalCalls } = decisionDb({ correction: fractional });
	await assert.rejects(
		() => decideCodMarkCorrection({ db: fractionalDb, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" }),
		{ statusCode: 409 },
	);
	assert.equal(fractionalCalls.markUpdate, null);
	assert.equal(fractionalCalls.markCreate, null);
});

test("COD rejection requires comments and leaves marks unchanged", async () => {
	const { db, calls } = decisionDb();
	await assert.rejects(
		() => decideCodMarkCorrection({ db, userId: "cod-user", correctionId: "correction-1", decision: "REJECT" }),
		{ statusCode: 400 },
	);
	const result = await decideCodMarkCorrection({ db, userId: "cod-user", correctionId: "correction-1", decision: "REJECT", comments: "Evidence does not support the change." });
	assert.equal(result.status, "REJECTED");
	assert.equal(calls.markUpdate, null);
	assert.equal(calls.markCreate, null);
	assert.equal(calls.correctionUpdate.data.finalValue, null);
	assert.equal(calls.outbox.length, 2);
});

test("repeated COD decisions conflict without another mark write", async () => {
	const alreadyDecided = correctionForDecision({ status: "APPROVED" });
	const { db, calls } = decisionDb({ correction: alreadyDecided });
	await assert.rejects(
		() => decideCodMarkCorrection({ db, userId: "cod-user", correctionId: "correction-1", decision: "APPROVE" }),
		{ statusCode: 409 },
	);
	assert.equal(calls.markUpdate, null);
	assert.equal(calls.markCreate, null);
});

test("student marks are scoped to the authenticated student's profile and optional period", async () => {
	let lookup;
	let resultWhere;
	const db = {
		studentProfile: { findUnique: async ({ where }) => { lookup = where; return { id: "student-1" }; } },
		academicPeriod: { findUnique: async () => ({ id: period.id }) },
		studentMark: { findMany: async ({ where }) => { resultWhere = where; return []; } },
	};
	await getStudentMarks({ db, userId: "student-user", academicPeriodId: period.id });
	assert.deepEqual(lookup, { userId: "student-user" });
	assert.equal(resultWhere.enrollment.studentProfileId, "student-1");
	assert.equal(resultWhere.enrollment.academicPeriodId, period.id);
});
