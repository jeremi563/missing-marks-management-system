import test from "node:test";
import assert from "node:assert/strict";
import {
	addStudentClarification,
	getStudentReportComments,
	markStudentNotificationRead,
	submitStudentAppeal,
	updateStudentReport,
	withdrawStudentReport,
} from "../../src/modules/student/student.service.js";

const student = { id: "student-1" };

function transactionClient(overrides = {}) {
	return {
		$queryRaw: overrides.$queryRaw ?? (async () => [{ id: "report-1" }]),
		missingMarkReport: {
			findFirst: async () => ({ id: "report-1", studentProfileId: student.id, status: "Submitted" }),
			updateMany: async () => ({ count: 1 }),
			findUnique: async () => ({ id: "report-1", status: "Submitted" }),
			...overrides.missingMarkReport,
		},
		reportStatusHistory: { create: async () => ({ id: "history-1" }), ...overrides.reportStatusHistory },
		appeal: { findFirst: async () => null, create: async ({ data }) => ({ id: "appeal-1", ...data }), ...overrides.appeal },
		reportComment: { create: async ({ data }) => ({ id: "comment-1", ...data }), ...overrides.reportComment },
		auditLog: { create: async () => ({ id: "audit-1" }), ...overrides.auditLog },
	};
}

test("student report comments query exposes only explicitly visible lecturer comments and the student's own replies", async () => {
	let commentQuery;
	const prisma = {
		studentProfile: { findUnique: async () => student },
		missingMarkReport: { findFirst: async () => ({ id: "report-1", studentProfileId: student.id }) },
		reportComment: { findMany: async (query) => { commentQuery = query; return []; } },
	};

	await getStudentReportComments(prisma, "user-1", "report-1");

	assert.deepEqual(commentQuery.where, {
		reportId: "report-1",
		OR: [{ isStudentVisible: true }, { authorUserId: "user-1" }],
	});
});

test("students can add a clarification only to their own report", async () => {
	let createArgs;
	const transaction = transactionClient({
		reportComment: { create: async (args) => { createArgs = args; return { id: "comment-1", ...args.data }; } },
	});
	const prisma = {
		studentProfile: { findUnique: async () => student },
		missingMarkReport: { findFirst: async () => ({ id: "report-1", studentProfileId: student.id }) },
		reportComment: { create: async ({ data }) => { createArgs = { data }; return { id: "comment-1", ...data }; } },
		$transaction: async (callback) => callback(transaction),
	};

	const result = await addStudentClarification(prisma, "user-1", "report-1", "  I submitted the CAT on time.  ");

	assert.deepEqual(createArgs.data, {
		reportId: "report-1",
		authorUserId: "user-1",
		body: "I submitted the CAT on time.",
		isStudentVisible: true,
	});
	assert.equal(result.body, "I submitted the CAT on time.");
});

test("appeals are limited to rejected reports and the database row is locked before checking the one-appeal limit", async () => {
	let lockQuery;
	let appealLookup;
	const transaction = transactionClient({
		$queryRaw: async (strings, ...values) => { lockQuery = { strings: [...strings], values }; return [{ id: "report-1" }]; },
		missingMarkReport: {
			findFirst: async () => ({ id: "report-1", studentProfileId: student.id, status: "REJECTED" }),
		},
		appeal: {
			findFirst: async (args) => { appealLookup = args; return null; },
		},
	});
	const prisma = {
		studentProfile: { findUnique: async () => student },
		$transaction: async (callback) => callback(transaction),
	};

	const appeal = await submitStudentAppeal(prisma, "user-1", "report-1", { reason: "Please review the decision." });

	assert.equal(appeal.status, "Submitted");
	assert.deepEqual(lockQuery.values, ["report-1", student.id]);
	assert.match(lockQuery.strings.join("?"), /FOR UPDATE/);
	assert.deepEqual(appealLookup.where, { reportId: "report-1" });
});

test("appeals reject approved decisions and statuses that are not final rejection", async () => {
	for (const status of ["APPROVED", "Submitted", "Under Review"]) {
		const transaction = transactionClient({
			missingMarkReport: { findFirst: async () => ({ id: "report-1", studentProfileId: student.id, status }) },
		});
		const prisma = {
			studentProfile: { findUnique: async () => student },
			$transaction: async (callback) => callback(transaction),
		};
		await assert.rejects(submitStudentAppeal(prisma, "user-1", "report-1", { reason: "Please review." }), { statusCode: 409 });
	}
});

test("report edits condition the write on ownership and Submitted status", async () => {
	let updateArgs;
	const report = { id: "report-1", studentProfileId: student.id, status: "Submitted", courseUnitId: "unit-1" };
	const transaction = transactionClient({
		missingMarkReport: {
			updateMany: async (args) => { updateArgs = args; return { count: 1 }; },
			findUnique: async () => ({ id: "report-1", status: "Submitted", description: "Updated" }),
		},
	});
	const prisma = {
		studentProfile: { findUnique: async () => student },
		missingMarkReport: { findUnique: async () => report },
		$transaction: async (callback) => callback(transaction),
	};

	await updateStudentReport(prisma, "user-1", "report-1", { description: "Updated" });

	assert.deepEqual(updateArgs.where, { id: "report-1", studentProfileId: student.id, status: "Submitted" });
});

test("withdrawal conditions the status transition on ownership and Submitted state", async () => {
	let updateArgs;
	const transaction = transactionClient({
		missingMarkReport: { updateMany: async (args) => { updateArgs = args; return { count: 1 }; } },
	});
	const prisma = {
		studentProfile: { findUnique: async () => student },
		missingMarkReport: { findUnique: async () => ({ id: "report-1", studentProfileId: student.id, status: "Submitted" }) },
		$transaction: async (callback) => callback(transaction),
	};

	const result = await withdrawStudentReport(prisma, "user-1", "report-1");

	assert.deepEqual(updateArgs.where, { id: "report-1", studentProfileId: student.id, status: "Submitted" });
	assert.equal(result.status, "Withdrawn");
});

test("students can mark only their own notification as read", async () => {
	let updateArgs;
	const notification = { id: "notification-1", userId: "user-1", readAt: new Date() };
	const prisma = {
		notification: {
			updateMany: async (args) => { updateArgs = args; return { count: 1 }; },
			findFirst: async ({ where }) => where.userId === "user-1" ? notification : null,
		},
	};

	const result = await markStudentNotificationRead(prisma, "user-1", "notification-1");

	assert.deepEqual(updateArgs.where, { id: "notification-1", userId: "user-1", readAt: null });
	assert.ok(result.readAt);
});

test("an edit loses safely when a staff decision changes the report before the conditional write", async () => {
	let historyWritten = false;
	const prisma = {
		studentProfile: { findUnique: async () => student },
		missingMarkReport: { findUnique: async () => ({ id: "report-1", studentProfileId: student.id, status: "Submitted", courseUnitId: "unit-1" }) },
		$transaction: async (callback) => callback(transactionClient({
			missingMarkReport: { updateMany: async () => ({ count: 0 }) },
			reportStatusHistory: { create: async () => { historyWritten = true; } },
		})),
	};

	await assert.rejects(updateStudentReport(prisma, "user-1", "report-1", { description: "Updated" }), { statusCode: 409 });
	assert.equal(historyWritten, false);
});

test("a withdrawal loses safely when a staff decision changes the report first", async () => {
	const prisma = {
		studentProfile: { findUnique: async () => student },
		missingMarkReport: { findUnique: async () => ({ id: "report-1", studentProfileId: student.id, status: "Submitted" }) },
		$transaction: async (callback) => callback(transactionClient({
			missingMarkReport: { updateMany: async () => ({ count: 0 }) },
		})),
	};

	await assert.rejects(withdrawStudentReport(prisma, "user-1", "report-1"), { statusCode: 409 });
});

test("notification read-state hides notifications owned by another user", async () => {
	const prisma = {
		notification: {
			updateMany: async ({ where }) => {
				assert.deepEqual(where, { id: "notification-1", userId: "user-1", readAt: null });
				return { count: 0 };
			},
			findFirst: async () => null,
		},
	};

	await assert.rejects(markStudentNotificationRead(prisma, "user-1", "notification-1"), {
		statusCode: 404,
		message: "Notification not found.",
	});
});
