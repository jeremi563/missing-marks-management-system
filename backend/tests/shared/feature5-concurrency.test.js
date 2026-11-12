import test from "node:test";
import assert from "node:assert/strict";
import { createSpecialCase, designateDepartmentCod, startAssignedReportWork } from "../../src/shared/services/feature5.service.js";
import { submitStudentAppeal } from "../../src/modules/student/student.service.js";

function deferred() {
	let resolve;
	const promise = new Promise((done) => { resolve = done; });
	return { promise, resolve };
}

function makeReviewFixture({ appealMode = false } = {}) {
	let currentCod = "cod-old";
	let nextCase = 0;
	let nextAppeal = 0;
	let tail = Promise.resolve();
	const events = [];
	const cases = [];
	const appeals = [];
	const lockSignals = [];
	const assignment = { id: "assignment-1", newLecturerProfileId: "lecturer-profile", workStartedAt: null, deadlineAt: null };
	const report = {
		id: "report-1", status: appealMode ? "REJECTED" : "PENDING", studentProfileId: "student-profile", assignedLecturerProfileId: "lecturer-profile",
		courseUnit: { department: { id: "dept-1" } },
	};
	const department = () => ({ id: "dept-1", designatedCodUserId: currentCod });
	const user = {
		findFirst: async ({ where }) => where.id === currentCod || where.id === "cod-old" || where.id === "cod-new"
			? { id: where.id, roles: [{ role: { name: "lecturer" } }, { role: { name: "cod" } }] }
			: null,
	};
	const txModels = {
		user,
		department: {
			findUnique: async () => department(),
			count: async () => 0,
			update: async ({ data }) => { currentCod = data.designatedCodUserId; return { id: "dept-1", ...data }; },
		},
		departmentMembership: { findUnique: async () => ({ id: "membership" }), create: async () => ({ id: "membership" }) },
		role: { upsert: async () => ({ id: "cod-role" }) },
		userRole: { create: async () => {}, deleteMany: async () => {} },
		missingMarkReport: {
			findUnique: async () => ({ ...report, courseUnit: { department: department() }, student: { userId: "student-user" } }),
			findFirst: async () => ({ id: report.id, status: report.status, courseUnit: { department: department() } }),
			findMany: async () => assignment.workStartedAt ? [{ ...report, reference: "R-1", assignments: [{ ...assignment }] }] : [],
		},
		studentProfile: { findUnique: async () => ({ id: "student-profile" }) },
		lecturerProfile: { findUnique: async ({ where }) => where.userId ? { id: "lecturer-profile" } : { userId: "lecturer-user" } },
		specialCaseCategory: { findFirst: async () => ({ id: "category-1", name: "Other" }) },
		specialCase: {
			create: async ({ data }) => {
				const item = { id: `case-${++nextCase}`, reportId: data.reportId, reviewDeadlineAt: data.reviewDeadlineAt, status: data.status };
				cases.push(item);
				return { ...item, submittedByUserId: data.submittedByUserId, categoryId: data.categoryId, category: data.category, description: data.description, createdAt: new Date() };
			},
			findMany: async () => cases.filter((item) => item.status === "Submitted").map(({ id, reportId, reviewDeadlineAt }) => ({ id, reportId, reviewDeadlineAt })),
		},
		appeal: {
			findMany: async () => appeals.filter((item) => item.status === "Submitted").map(({ id, reportId, reviewDeadlineAt }) => ({ id, reportId, reviewDeadlineAt })),
			findFirst: async () => appeals[0] ? { id: appeals[0].id } : null,
			create: async ({ data }) => { const item = { id: `appeal-${++nextAppeal}`, ...data, createdAt: new Date(), updatedAt: new Date() }; appeals.push(item); return item; },
		},
		reportStatusHistory: { findFirst: async () => ({ createdAt: new Date(Date.now() - 60_000) }) },
		reportAssignment: {
			findFirst: async () => ({ id: assignment.id, workStartedAt: assignment.workStartedAt }),
			updateMany: async ({ data }) => { if (assignment.workStartedAt) return { count: 0 }; Object.assign(assignment, data); return { count: 1 }; },
		},
		publicHoliday: { findMany: async () => [] },
		notificationOutbox: {
			create: async ({ data }) => {
				if (events.some((event) => event.dedupeKey === data.dedupeKey)) { const error = new Error("duplicate"); error.code = "P2002"; throw error; }
				events.push(data);
				return data;
			},
		},
		auditLog: { create: async () => ({ id: "audit-1" }) },
	};

	function makeTx() {
		const acquired = deferred();
		lockSignals.push(acquired.promise);
		let release;
		return {
			...txModels,
			$queryRaw: async (strings) => {
				const sql = strings.join(" ");
				if (sql.includes("FROM departments") && sql.includes("FOR UPDATE")) {
					const previous = tail;
					let unlock;
					tail = new Promise((resolve) => { unlock = resolve; });
					await previous;
					release = unlock;
					acquired.resolve();
					return [{ id: "dept-1" }];
				}
				if (sql.includes("FROM users") && sql.includes("FOR UPDATE")) return [{ id: "cod-user" }];
				if (sql.includes("FROM missing_mark_reports")) return [{ id: "report-1" }];
				throw new Error(`Unexpected query: ${sql}`);
			},
			finish: () => release?.(),
		};
	}
	const db = {
		$transaction: async (callback) => {
			const tx = makeTx();
			try { return await callback(tx); } finally { tx.finish(); }
		},
	};
	const rootDb = { ...db, studentProfile: { findUnique: async () => ({ id: "student-profile" }) } };
	return { db, rootDb, events, cases, appeals, assignment, getCurrentCod: () => currentCod, lockSignals };
}

async function runRace(submission, replaceFirst = false) {
	const fixture = makeReviewFixture({ appealMode: submission === "student-appeal" });
	const replace = () => designateDepartmentCod({ db: fixture.db, actorUserId: "admin-user", departmentId: "dept-1", codUserId: "cod-new" });
	const submitWork = () => submission === "special-case"
		? createSpecialCase({ db: fixture.db, userId: "student-user", role: "student", reportId: "report-1", categoryId: "category-1", description: "Review requested" })
		: submission === "student-appeal"
			? submitStudentAppeal(fixture.rootDb, "student-user", "report-1", { reason: "Please review" })
		: startAssignedReportWork({ db: fixture.db, userId: "lecturer-user", reportId: "report-1" });
	let replacement;
	let submit;
	if (replaceFirst) {
		replacement = replace();
		await fixture.lockSignals[0];
		submit = submitWork();
		await replacement;
	} else {
		submit = submitWork();
		await fixture.lockSignals[0];
		replacement = replace();
		await replacement;
	}
	await submit;
	// Start Working queues its COD event at the point work starts; special cases
	// queue at submission. In either serialization order, outstanding work is
	// addressed to the current designation and deduplication is recipient-scoped.
	if (submission === "special-case") {
		assert.equal(fixture.cases.length, 1);
		assert.ok(fixture.events.some((event) => event.eventType === "COD_SPECIAL_CASE_OVERDUE" && event.recipientUserId === "cod-new"));
	} else if (submission === "student-appeal") {
		assert.equal(fixture.appeals.length, 1);
		assert.ok(fixture.events.some((event) => event.eventType === "COD_APPEAL_OVERDUE" && event.recipientUserId === "cod-new"));
	} else {
		assert.equal(fixture.assignment.workStartedAt instanceof Date, true);
		assert.ok(fixture.events.some((event) => event.eventType === "COD_REPORT_OVERDUE" && event.recipientUserId === "cod-new"));
	}
	assert.equal(fixture.getCurrentCod(), "cod-new");
	assert.equal(fixture.events.filter((event) => event.eventType.startsWith("COD_") && event.recipientUserId === "cod-new").length, 1);
	// Repeating designation/requeue is idempotent.
	await designateDepartmentCod({ db: fixture.db, actorUserId: "admin-user", departmentId: "dept-1", codUserId: "cod-new" });
	assert.equal(fixture.events.filter((event) => event.eventType.startsWith("COD_") && event.recipientUserId === "cod-new").length, 1);
}

for (const operation of ["special-case", "student-appeal", "start-work"]) {
	for (const replaceFirst of [false, true]) {
		test(`department locking serializes ${operation} with COD replacement (${replaceFirst ? "replacement first" : "submission first"})`, async () => {
			await runRace(operation, replaceFirst);
		});
	}
}
