import test from "node:test";
import assert from "node:assert/strict";
import {
	createStandaloneStudentSpecialCase,
	decideSpecialCase,
	getStudentSpecialCase,
	listStudentSpecialCaseOptions,
	listStudentSpecialCases,
	listLecturerSpecialCases,
	recommendStandaloneSpecialCase,
} from "../../src/shared/services/feature5.service.js";
import { assertEvidenceAccess } from "../../src/shared/services/evidence.service.js";

const now = new Date("2025-03-01T12:00:00.000Z");
const period = {
	id: "period-1",
	code: "2024-T1",
	name: "2024 Term 1",
	startsAt: new Date("2024-09-01T00:00:00.000Z"),
	endsAt: new Date("2025-09-01T00:00:00.000Z"),
};
const pdf = Buffer.from("%PDF-1.7\nsample\n%%EOF");

function createDb(overrides = {}) {
	const writes = { cases: [], evidence: [], audits: [], notifications: [] };
	const db = {
		$queryRaw: async () => [{ id: "department-1" }],
		$transaction: async (callback) => callback(db),
		studentProfile: { findUnique: async () => ({ id: "student-profile-1" }) },
		unitEnrollment: {
			findUnique: async () => ({
				id: "enrollment-1",
				academicPeriod: period,
				courseUnit: { id: "unit-1", code: "UNIT101", name: "Unit 101", departmentId: "department-1" },
			}),
			findMany: async () => [],
		},
		assessment: {
			findFirst: async () => ({ id: "assessment-1", code: "EXAM1", name: "Final Exam", type: "EXAM", assessmentDate: new Date("2025-02-01T09:00:00.000Z") }),
			findMany: async () => [],
		},
		specialCaseCategory: { findFirst: async () => ({ id: "category-1", code: "MEDICAL", name: "Medical emergency" }), findMany: async () => [] },
		specialCase: {
			findUnique: async () => null,
			create: async ({ data }) => {
				const result = { id: "case-1", createdAt: now, ...data };
				writes.cases.push(result);
				return result;
			},
			findMany: async () => [],
			count: async () => 0,
		},
		courseUnitLecturer: { findMany: async () => [{ lecturer: { userId: "lecturer-user-1" } }] },
		specialCaseEvidence: {
			create: async ({ data }) => {
				const result = { id: `evidence-${writes.evidence.length + 1}`, createdAt: now, ...data };
				writes.evidence.push(result);
				return result;
			},
			findMany: async () => [],
		},
		auditLog: { create: async ({ data }) => { writes.audits.push(data); return data; } },
		notificationOutbox: { create: async ({ data }) => { writes.notifications.push(data); return data; } },
		user: { findMany: async () => [{ id: "admin-user-1" }] },
		...overrides,
	};
	return { db, writes };
}

function files() {
	return [{ originalName: "evidence.pdf", mediaType: "application/pdf", buffer: pdf }];
}

function recommendationDb({ status = "PENDING_LECTURER_REVIEW", administrativeResolutionRequired = false, assigned = true, validCod = true } = {}) {
	const writes = { updates: [], reviews: [], audits: [], notifications: [] };
	const db = {
		$transaction: async (callback) => callback(db),
		$queryRaw: async () => [{ id: "department-1" }],
		specialCase: {
			findUnique: async () => ({
				id: "case-1",
				reportId: null,
				studentProfileId: "student-profile-1",
				courseUnitId: "unit-1",
				academicPeriodId: "period-1",
				status,
				administrativeResolutionRequired,
				student: { userId: "student-user-1" },
				courseUnit: { id: "unit-1", departmentId: "department-1" },
				academicPeriod: period,
			}),
			updateMany: async (args) => { writes.updates.push(args); return { count: 1 }; },
		},
		lecturerProfile: { findUnique: async () => ({ id: "lecturer-profile-1" }) },
		courseUnitLecturer: { findFirst: async () => assigned ? ({ id: "assignment-1" }) : null },
		department: { findUnique: async () => ({ id: "department-1", designatedCodUserId: "cod-user-1" }) },
		user: { findFirst: async () => validCod ? ({ id: "cod-user-1" }) : null },
		specialCaseReview: { create: async ({ data }) => {
			const review = { id: "review-1", createdAt: now, ...data };
			writes.reviews.push(review);
			return review;
		} },
		auditLog: { create: async ({ data }) => { writes.audits.push(data); return data; } },
		notificationOutbox: { create: async ({ data }) => { writes.notifications.push(data); return data; } },
	};
	return { db, writes };
}

test("student submits a standalone case with evidence, an audit event, and privacy-conscious notifications", async () => {
	const { db, writes } = createDb();
	const result = await createStandaloneStudentSpecialCase({
		db,
		userId: "student-user-1",
		courseUnitId: "unit-1",
		academicPeriodId: "period-1",
		assessmentId: "assessment-1",
		categoryId: "category-1",
		description: "I was hospitalized during the examination.",
		files: files(),
		storage: { write: async () => "a".repeat(64), remove: async () => {} },
		now,
	});

	assert.equal(result.reportId, null);
	assert.equal(result.status, "PENDING_LECTURER_REVIEW");
	assert.equal(result.administrativeResolutionRequired, false);
	assert.equal(result.evidence.length, 1);
	assert.equal(writes.cases[0].studentProfileId, "student-profile-1");
	assert.equal(writes.cases[0].assessmentId, "assessment-1");
	assert.equal(writes.evidence[0].reportId, null);
	assert.equal(writes.audits.some(({ action }) => action === "SPECIAL_CASE_SUBMITTED_STANDALONE"), true);
	assert.deepEqual(writes.notifications.map(({ eventType }) => eventType), ["SPECIAL_CASE_SUBMITTED", "SPECIAL_CASE_REVIEW_REQUIRED"]);
	assert.equal(writes.notifications.some(({ message }) => message.includes("hospitalized")), false);
});

test("student cannot submit without evidence", async () => {
	let transactions = 0;
	const { db } = createDb({ $transaction: async () => { transactions += 1; } });
	await assert.rejects(createStandaloneStudentSpecialCase({
		db,
		userId: "student-user-1",
		courseUnitId: "unit-1",
		academicPeriodId: "period-1",
		assessmentId: "assessment-1",
		categoryId: "category-1",
		description: "Please consider my application.",
		files: [],
	}), { statusCode: 422 });
	assert.equal(transactions, 0);
});

test("student must be enrolled and select an assessment that has already occurred within the period", async (t) => {
	await t.test("rejects unenrolled course units", async () => {
		const { db, writes } = createDb({ unitEnrollment: { findUnique: async () => null } });
		await assert.rejects(createStandaloneStudentSpecialCase({
			db, userId: "student-user-1", courseUnitId: "unit-1", academicPeriodId: "period-1",
			assessmentId: "assessment-1", categoryId: "category-1", description: "Reason", files: files(),
			storage: { write: async () => "b".repeat(64), remove: async () => {} }, now,
		}), { statusCode: 422 });
		assert.equal(writes.cases.length, 0);
	});

	await t.test("rejects future assessments", async () => {
		const { db, writes } = createDb({
			assessment: { findFirst: async () => ({ id: "assessment-1", assessmentDate: new Date("2025-04-01T09:00:00.000Z") }) },
		});
		await assert.rejects(createStandaloneStudentSpecialCase({
			db, userId: "student-user-1", courseUnitId: "unit-1", academicPeriodId: "period-1",
			assessmentId: "assessment-1", categoryId: "category-1", description: "Reason", files: files(),
			storage: { write: async () => "c".repeat(64), remove: async () => {} }, now,
		}), { statusCode: 422 });
		assert.equal(writes.cases.length, 0);
	});

	await t.test("rejects assessments outside the selected period", async () => {
		const { db } = createDb({
			assessment: { findFirst: async () => ({ id: "assessment-1", assessmentDate: new Date("2023-08-01T09:00:00.000Z") }) },
		});
		await assert.rejects(createStandaloneStudentSpecialCase({
			db, userId: "student-user-1", courseUnitId: "unit-1", academicPeriodId: "period-1",
			assessmentId: "assessment-1", categoryId: "category-1", description: "Reason", files: files(),
			storage: { write: async () => "d".repeat(64), remove: async () => {} }, now,
		}), { statusCode: 422 });
	});

	await t.test("requires the assessment to belong to the selected course unit", async () => {
		const { db } = createDb({
			assessment: { findFirst: async ({ where }) => where.courseUnitId === "unit-1"
				? ({ id: "assessment-1", assessmentDate: new Date("2025-02-01T09:00:00.000Z") })
				: null },
		});
		await assert.rejects(createStandaloneStudentSpecialCase({
			db, userId: "student-user-1", courseUnitId: "different-unit", academicPeriodId: "period-1",
			assessmentId: "assessment-1", categoryId: "category-1", description: "Reason", files: files(),
			storage: { write: async () => "2".repeat(64), remove: async () => {} }, now,
		}), { statusCode: 422 });
	});
});

test("duplicate cases are rejected and missing lecturer assignment is flagged for administration", async (t) => {
	await t.test("rejects a previous application", async () => {
		const { db, writes } = createDb({
			specialCase: {
				findUnique: async () => ({ id: "existing-case" }),
				create: async () => { writes.cases.push("unexpected"); },
			},
		});
		await assert.rejects(createStandaloneStudentSpecialCase({
			db, userId: "student-user-1", courseUnitId: "unit-1", academicPeriodId: "period-1",
			assessmentId: "assessment-1", categoryId: "category-1", description: "Reason", files: files(),
			storage: { write: async () => "e".repeat(64), remove: async () => {} }, now,
		}), { statusCode: 409 });
		assert.equal(writes.cases.length, 0);
	});

	await t.test("translates database uniqueness conflicts", async () => {
		const { db } = createDb({
			specialCase: { findUnique: async () => null, create: async () => {
				const error = new Error("unique conflict");
				error.code = "P2002";
				error.meta = { target: ["studentProfileId", "assessmentId"] };
				throw error;
			} },
		});
		await assert.rejects(createStandaloneStudentSpecialCase({
			db, userId: "student-user-1", courseUnitId: "unit-1", academicPeriodId: "period-1",
			assessmentId: "assessment-1", categoryId: "category-1", description: "Reason", files: files(),
			storage: { write: async () => "f".repeat(64), remove: async () => {} }, now,
		}), { statusCode: 409 });
	});

	await t.test("sets administrative resolution and alerts administrators when no assignment exists", async () => {
		const { db, writes } = createDb({ courseUnitLecturer: { findMany: async () => [] } });
		const result = await createStandaloneStudentSpecialCase({
			db, userId: "student-user-1", courseUnitId: "unit-1", academicPeriodId: "period-1",
			assessmentId: "assessment-1", categoryId: "category-1", description: "Reason", files: files(),
			storage: { write: async () => "1".repeat(64), remove: async () => {} }, now,
		});
		assert.equal(result.administrativeResolutionRequired, true);
		assert.equal(writes.notifications.some(({ eventType }) => eventType === "SPECIAL_CASE_ASSIGNMENT_RESOLUTION_REQUIRED"), true);
		assert.equal(writes.notifications.some(({ eventType }) => eventType === "SPECIAL_CASE_REVIEW_REQUIRED"), false);
	});
});

test("student options include only enrolled past assessments and omit already-submitted assessments", async () => {
	const { db } = createDb({
		unitEnrollment: { findMany: async () => [{ academicPeriod: period, courseUnit: { id: "unit-1", code: "UNIT101", name: "Unit 101" } }] },
		assessment: { findMany: async ({ where }) => [
			{ id: "assessment-1", assessmentDate: new Date("2025-02-01T09:00:00.000Z") },
			{ id: "assessment-2", assessmentDate: new Date("2025-04-01T09:00:00.000Z") },
		].filter(({ assessmentDate }) => assessmentDate >= where.assessmentDate.gte && assessmentDate < where.assessmentDate.lt) },
		specialCase: { findMany: async () => [{ assessmentId: "assessment-1" }] },
		specialCaseCategory: { findMany: async () => [{ id: "category-1", name: "Medical emergency" }] },
	});
	const result = await listStudentSpecialCaseOptions({ db, userId: "student-user-1", now });
	assert.deepEqual(result.categories, [{ id: "category-1", name: "Medical emergency" }]);
	assert.deepEqual(result.enrollments[0].assessments, []);
});

test("students can list and inspect their own standalone cases but cannot inspect another student's case", async (t) => {
	const item = {
		id: "case-1", reportId: null, studentProfileId: "student-profile-1", submittedByUserId: "student-user-1",
		categoryId: "category-1", category: "Medical emergency", description: "Private explanation", status: "PENDING_LECTURER_REVIEW",
		courseUnitId: "unit-1", academicPeriodId: "period-1", assessmentId: "assessment-1", evidence: [], reviews: [], schedules: [], attendances: [],
	};
	const { db } = createDb({
		specialCase: {
			findMany: async () => [item],
			count: async () => 1,
			findUnique: async () => item,
		},
		specialCaseEvidence: { findMany: async () => [] },
	});
	const list = await listStudentSpecialCases({ db, userId: "student-user-1" });
	assert.equal(list.items[0].id, "case-1");
	assert.equal(list.pagination.total, 1);
	assert.equal((await getStudentSpecialCase({ db, userId: "student-user-1", caseId: "case-1" })).id, "case-1");

	db.studentProfile.findUnique = async () => ({ id: "another-student-profile" });
	await assert.rejects(getStudentSpecialCase({ db, userId: "other-student", caseId: "case-1" }), { statusCode: 404 });
});

test("standalone evidence is available only to its owning student", async () => {
	const evidence = {
		reportId: null,
		appealId: null,
		specialCaseId: "case-1",
		report: null,
		appeal: null,
		specialCase: {
			reportId: null,
			studentProfileId: "student-profile-1",
			submittedByUserId: "student-user-1",
			courseUnitId: "unit-1",
			courseUnit: { departmentId: "department-1" },
			academicPeriod: { startsAt: period.startsAt },
		},
	};
	const db = {
		studentProfile: { findUnique: async ({ where }) => where.userId === "student-user-1" ? { id: "student-profile-1" } : { id: "other-profile" } },
		lecturerProfile: { findUnique: async () => ({ id: "lecturer-profile-1" }) },
		courseUnitLecturer: { findFirst: async () => ({ id: "assignment-1" }) },
	};
	await assertEvidenceAccess({ db, userId: "student-user-1", roles: ["student"], evidence });
	await assert.rejects(assertEvidenceAccess({ db, userId: "other-student", roles: ["student"], evidence }), { statusCode: 404 });
	await assertEvidenceAccess({ db, userId: "lecturer-user-1", roles: ["lecturer"], evidence });
	await assertEvidenceAccess({
		db,
		userId: "lecturer-user-1",
		roles: ["lecturer"],
		evidence: { ...evidence, specialCase: { ...evidence.specialCase, administrativeResolutionRequired: true } },
	});
});

test("lecturer special-case queue is scoped to active unit assignments for the period's academic year", async () => {
	let query;
	const db = {
		lecturerProfile: { findUnique: async () => ({ id: "lecturer-profile-1" }) },
		courseUnitLecturer: { findMany: async () => [{ courseUnitId: "unit-1", academicYear: "2024/25" }] },
		specialCase: {
			findMany: async (args) => { query = args.where; return []; },
			count: async () => 0,
		},
	};
	await listLecturerSpecialCases({ db, userId: "lecturer-user-1" });
	assert.ok(query.OR.some((scope) => scope.courseUnitId === "unit-1" && scope.reportId === null));
	const scope = query.OR.find((item) => item.courseUnitId === "unit-1");
	assert.equal("administrativeResolutionRequired" in scope, false);
	assert.equal(scope.academicPeriod.startsAt.gte.toISOString(), "2024-08-31T21:00:00.000Z");
	assert.equal(scope.academicPeriod.startsAt.lt.toISOString(), "2025-08-31T21:00:00.000Z");
});

test("assigned lecturer recommendation advances a standalone case to COD review without making a final decision", async () => {
	const { db, writes } = recommendationDb();
	const result = await recommendStandaloneSpecialCase({
		db,
		userId: "lecturer-user-1",
		caseId: "case-1",
		recommendation: "RECOMMEND_REJECTION",
		reason: "The evidence does not establish that the assessment was missed.",
	});

	assert.equal(result.status, "PENDING_COD_REVIEW");
	assert.equal(writes.updates[0].data.status, "PENDING_COD_REVIEW");
	assert.equal(writes.reviews[0].reviewerUserId, "lecturer-user-1");
	assert.equal(writes.reviews[0].reviewerRole, "LECTURER");
	assert.equal(writes.reviews[0].decision, "RECOMMEND_REJECTION");
	assert.equal(writes.reviews[0].comments, "The evidence does not establish that the assessment was missed.");
	assert.equal(writes.audits[0].action, "SPECIAL_CASE_LECTURER_RECOMMENDED");
	assert.deepEqual(writes.notifications.map(({ eventType }) => eventType), [
		"SPECIAL_CASE_LECTURER_RECOMMENDATION",
		"SPECIAL_CASE_COD_REVIEW_REQUIRED",
	]);
	assert.equal(writes.notifications.some(({ message }) => message.includes("evidence does not establish")), false);
	assert.equal("decisionByUserId" in writes.updates[0].data, false);
});

test("lecturer recommendation requires assignment, a pending review, and a valid COD", async (t) => {
	const input = {
		userId: "lecturer-user-1",
		caseId: "case-1",
		recommendation: "RECOMMEND_APPROVAL",
		reason: "The application is supported.",
	};

	await t.test("rejects a lecturer without the active unit-year assignment", async () => {
		const { db, writes } = recommendationDb({ assigned: false });
		await assert.rejects(recommendStandaloneSpecialCase({ db, ...input }), { statusCode: 404 });
		assert.equal(writes.updates.length, 0);
	});

	await t.test("rejects a case outside the lecturer-review state", async () => {
		const { db, writes } = recommendationDb({ status: "PENDING_COD_REVIEW" });
		await assert.rejects(recommendStandaloneSpecialCase({ db, ...input }), { statusCode: 409 });
		assert.equal(writes.updates.length, 0);
	});

	await t.test("resolves an assignment-pending case when its assigned lecturer reviews it", async () => {
		const { db, writes } = recommendationDb({ administrativeResolutionRequired: true });
		const result = await recommendStandaloneSpecialCase({ db, ...input });
		assert.equal(result.status, "PENDING_COD_REVIEW");
		assert.equal(writes.updates[0].data.administrativeResolutionRequired, false);
	});

	await t.test("does not advance a case when the department has no valid COD", async () => {
		const { db, writes } = recommendationDb({ validCod: false });
		await assert.rejects(recommendStandaloneSpecialCase({ db, ...input }), { statusCode: 409 });
		assert.equal(writes.updates.length, 0);
	});

	await t.test("requires a non-empty recommendation reason", async () => {
		const { db, writes } = recommendationDb();
		await assert.rejects(recommendStandaloneSpecialCase({ db, ...input, reason: "   " }), { statusCode: 422 });
		assert.equal(writes.updates.length, 0);
	});
});

test("legacy COD decision endpoint cannot bypass lecturer review for standalone cases", async () => {
	let updates = 0;
	const db = {
		$transaction: async (callback) => callback({
			specialCase: {
				findUnique: async () => ({ id: "case-1", reportId: null, status: "PENDING_COD_REVIEW", report: null }),
				updateMany: async () => { updates += 1; return { count: 1 }; },
			},
			specialCaseReview: { findFirst: async () => null },
		}),
	};
	await assert.rejects(decideSpecialCase({
		db,
		userId: "cod-user-1",
		caseId: "case-1",
		decision: "APPROVE",
		reason: "Attempt to bypass lecturer recommendation.",
	}), { statusCode: 409 });
	assert.equal(updates, 0);
});
