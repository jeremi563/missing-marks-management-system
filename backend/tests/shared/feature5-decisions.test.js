import test from "node:test";
import assert from "node:assert/strict";
import { decideAppeal, decideSpecialCase, designateDepartmentCod, getCodSpecialCase, listCodAppeals, listCodSpecialCases } from "../../src/shared/services/feature5.service.js";

function appealDb({ designatedCodUserId = "cod-1", reportStatus = "REJECTED" } = {}) {
	const calls = { reportUpdates: 0, history: 0, notifications: 0 };
	const tx = {
		appeal: {
			findUnique: async () => ({
				id: "appeal-1", reportId: "report-1", status: "Submitted", studentProfileId: "student-1",
				report: { status: reportStatus, courseUnit: { department: { id: "dept-1", designatedCodUserId } }, student: { userId: "student-user-1" } },
			}),
			updateMany: async () => ({ count: 1 }),
		},
		missingMarkReport: { updateMany: async () => { calls.reportUpdates += 1; return { count: 1 }; } },
		reportStatusHistory: { create: async ({ data }) => { calls.history += 1; return { id: "history-1", ...data }; } },
		auditLog: { create: async () => ({ id: "audit-1" }) },
		notification: {
			createMany: async () => { calls.notifications += 1; return { count: 1 }; },
			findUnique: async () => ({ id: "notification-1" }),
		},
		user: { findFirst: async ({ where }) => ({ id: where.id }) },
	};
	return { calls, db: { $transaction: (callback) => callback(tx) } };
}

test("approved appeals return rejected reports to PENDING and notify the student with the COD reason", async () => {
	const { db, calls } = appealDb();
	let notificationArgs;
	const transaction = db.$transaction;
	db.$transaction = (callback) => transaction((tx) => {
		const createMany = tx.notification.createMany;
		tx.notification.createMany = async ({ data, ...options }) => { notificationArgs = data[0]; return createMany({ data, ...options }); };
		return callback(tx);
	});
	const result = await decideAppeal({ db, userId: "cod-1", appealId: "appeal-1", decision: "APPROVE", reason: "The evidence supports reconsideration." });
	assert.equal(result.reportStatus, "PENDING");
	assert.equal(calls.reportUpdates, 1);
	assert.equal(calls.history, 1);
	assert.equal(notificationArgs.userId, "student-user-1");
	assert.match(notificationArgs.message, /The evidence supports reconsideration/);
});

test("rejected appeals preserve REJECTED report status and unauthorized COD decisions are denied", async () => {
	const { db, calls } = appealDb();
	const rejected = await decideAppeal({ db, userId: "cod-1", appealId: "appeal-1", decision: "REJECT", reason: "The records do not support the appeal." });
	assert.equal(rejected.reportStatus, "REJECTED");
	assert.equal(calls.reportUpdates, 0);
	assert.equal(calls.history, 0);
	await assert.rejects(decideAppeal({ db: appealDb({ designatedCodUserId: "other-cod" }).db, userId: "cod-1", appealId: "appeal-1", decision: "APPROVE", reason: "No access." }), { statusCode: 404 });
});

test("replacement COD can list and decide existing unresolved departmental appeals", async () => {
	const { db, calls } = appealDb({ designatedCodUserId: "cod-new" });
	const result = await decideAppeal({ db, userId: "cod-new", appealId: "appeal-1", decision: "REJECT", reason: "Reviewed by the replacement COD." });
	assert.equal(result.status, "Rejected");
	assert.equal(calls.notifications, 1);
	let appealWhere;
	const listDb = {
		department: { findMany: async ({ where }) => { assert.equal(where.designatedCodUserId, "cod-new"); return [{ id: "dept-1" }]; } },
		user: { findFirst: async ({ where }) => ({ id: where.id }) },
		appeal: {
			findMany: async ({ where }) => { appealWhere = where; return [{ id: "appeal-1", status: "Submitted" }]; },
			count: async () => 1,
		},
	};
	const listed = await listCodAppeals({ db: listDb, userId: "cod-new" });
	assert.equal(listed.items[0].id, "appeal-1");
	assert.deepEqual(appealWhere.report.courseUnit.departmentId.in, ["dept-1"]);
});

test("special-case decisions are final, attributed, and do not change report status", async () => {
	let updateArgs;
	let notificationData;
	const tx = {
		specialCase: {
			findUnique: async () => updateArgs
				? { id: "case-1", reportId: "report-1", status: updateArgs.data.status, decisionByUserId: updateArgs.data.decisionByUserId, decisionAt: updateArgs.data.decisionAt, decisionReason: updateArgs.data.decisionReason }
				: { id: "case-1", reportId: "report-1", status: "Submitted", submittedByUserId: "lecturer-user-1", report: { student: { userId: "student-user-1" }, courseUnit: { department: { id: "dept-1", designatedCodUserId: "cod-1" } } } },
			updateMany: async (args) => { updateArgs = args; return { count: 1 }; },
		},
		auditLog: { create: async () => ({ id: "audit-1" }) },
		notification: {
			createMany: async ({ data }) => { notificationData = data[0]; return { count: 1 }; },
			findUnique: async () => ({ id: "notification-1" }),
		},
		user: { findFirst: async () => ({ id: "cod-1" }) },
	};
	const db = { $transaction: (callback) => callback(tx) };
	const result = await decideSpecialCase({ db, userId: "cod-1", caseId: "case-1", decision: "REJECT", reason: "The documentation is incomplete." });
	assert.equal(updateArgs.data.status, "Rejected");
	assert.equal(updateArgs.data.decisionByUserId, "cod-1");
	assert.equal(result.decisionReason, "The documentation is incomplete.");
	assert.equal(notificationData.userId, "lecturer-user-1");
	assert.match(notificationData.message, /The documentation is incomplete/);
});

function replacementCaseDb() {
	let designatedCodUserId = "cod-old";
	const submittedCase = {
		id: "case-pending", reportId: "report-1", submittedByUserId: "lecturer-user-1", categoryId: "category-1", category: "Compassionate grounds",
		description: "Submitted before the COD replacement.", status: "Submitted", decisionByUserId: null, decisionAt: null, decisionReason: null,
		reviewDeadlineAt: new Date("2026-12-01T10:00:00.000Z"), createdAt: new Date("2026-11-01T10:00:00.000Z"),
		report: { reference: "MM-2026-0001", status: "PENDING", assignedLecturerProfileId: "lecturer-profile-1", student: { userId: "student-user-1" }, courseUnit: { departmentId: "dept-1", department: { id: "dept-1" } } },
		categoryRecord: { id: "category-1", code: "COMPASSIONATE", name: "Compassionate grounds", isActive: true },
	};
	const decidedCase = {
		id: "case-decided", reportId: "report-2", submittedByUserId: "student-user-2", categoryId: "category-2", category: "Other",
		description: "Previously decided case.", status: "Rejected", decisionByUserId: "cod-prior", decisionAt: new Date("2026-10-15T10:00:00.000Z"), decisionReason: "Prior recorded decision.",
		reviewDeadlineAt: new Date("2026-10-10T10:00:00.000Z"), createdAt: new Date("2026-10-01T10:00:00.000Z"),
		report: { reference: "MM-2026-0002", status: "PENDING", assignedLecturerProfileId: "lecturer-profile-2", student: { userId: "student-user-2" }, courseUnit: { departmentId: "dept-1", department: { id: "dept-1" } } },
		categoryRecord: { id: "category-2", code: "OTHER", name: "Other", isActive: true },
	};
	const otherDepartmentCase = {
		id: "case-other-department", reportId: "report-3", submittedByUserId: "student-user-3", categoryId: "category-3", category: "Other",
		description: "Belongs to a different department.", status: "Submitted", decisionByUserId: null, decisionAt: null, decisionReason: null,
		reviewDeadlineAt: new Date("2026-12-02T10:00:00.000Z"), createdAt: new Date("2026-11-02T10:00:00.000Z"),
		report: { reference: "MM-2026-0003", status: "PENDING", assignedLecturerProfileId: "lecturer-profile-3", student: { userId: "student-user-3" }, courseUnit: { departmentId: "dept-2", department: { id: "dept-2" } } },
		categoryRecord: { id: "category-3", code: "OTHER", name: "Other", isActive: true },
	};
	const cases = [submittedCase, decidedCase, otherDepartmentCase];
	const auditEntries = [{ id: "audit-history-1", actorId: "cod-prior", action: "SPECIAL_CASE_DECIDED", entityId: "case-decided", createdAt: new Date("2026-10-15T10:00:00.000Z") }];
	const outbox = [];
	const evidence = [{ id: "evidence-1", originalName: "supporting-document.pdf", mediaType: "application/pdf", sizeBytes: 2048, createdAt: new Date("2026-11-01T11:00:00.000Z"), uploadedBy: { id: "lecturer-user-1", displayName: "Lecturer One" } }];
	let evidenceReads = 0;
	const user = { findFirst: async ({ where }) => where.id === "cod-old" || where.id === "cod-new" ? { id: where.id } : null };
	const matchesCaseWhere = (item, where) => {
		const allowedDepartments = where.report?.courseUnit?.departmentId;
		const inDepartment = !allowedDepartments || (Array.isArray(allowedDepartments.in) ? allowedDepartments.in.includes(item.report.courseUnit.departmentId) : allowedDepartments === item.report.courseUnit.departmentId);
		return inDepartment && (!where.status || item.status === where.status);
	};
	const specialCase = {
		findMany: async ({ where }) => cases.filter((item) => matchesCaseWhere(item, where)).map((item) => ({ ...item, report: { reference: item.report.reference, status: item.report.status, courseUnit: { departmentId: item.report.courseUnit.departmentId } } })),
		count: async ({ where }) => cases.filter((item) => matchesCaseWhere(item, where)).length,
		findUnique: async () => ({ ...submittedCase, report: { assignedLecturerProfileId: submittedCase.report.assignedLecturerProfileId, courseUnit: { department: { id: "dept-1", designatedCodUserId } } } }),
		updateMany: async ({ data }) => { Object.assign(submittedCase, data); return { count: 1 }; },
	};
	const tx = {
		$queryRaw: async () => [{ id: "dept-1" }],
		user,
		department: {
			findUnique: async () => ({ id: "dept-1", designatedCodUserId }),
			update: async ({ data }) => { designatedCodUserId = data.designatedCodUserId; return { id: "dept-1", ...data }; },
		},
		appeal: { findMany: async () => [] },
		missingMarkReport: { findMany: async () => [] },
		specialCase: {
			...specialCase,
			findUnique: async () => ({ ...submittedCase, report: { student: { userId: submittedCase.report.student.userId }, courseUnit: { department: { id: "dept-1", designatedCodUserId } } } }),
		},
		notificationOutbox: { create: async ({ data }) => { outbox.push(data); return data; } },
		auditLog: { create: async ({ data }) => { const entry = { id: `audit-${auditEntries.length + 1}`, ...data }; auditEntries.push(entry); return entry; } },
		notification: { createMany: async () => ({ count: 1 }), findUnique: async () => ({ id: "notification-1" }) },
	};
	const db = {
		$transaction: (callback) => callback(tx),
		department: { findMany: async ({ where }) => where.designatedCodUserId === designatedCodUserId ? [{ id: "dept-1" }] : [] },
		user,
		specialCase,
		specialCaseEvidence: { findMany: async () => { evidenceReads += 1; return evidence; } },
	};
	return { db, cases, submittedCase, decidedCase, auditEntries, outbox, evidence, getEvidenceReads: () => evidenceReads, getDesignatedCod: () => designatedCodUserId };
}

test("replacement COD can list and open existing departmental special cases with authorized evidence metadata", async () => {
	const fixture = replacementCaseDb();
	await designateDepartmentCod({ db: fixture.db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-new" });
	const listed = await listCodSpecialCases({ db: fixture.db, userId: "cod-new" });
	assert.deepEqual(listed.items.map(({ id }) => id).sort(), ["case-decided", "case-pending"]);
	assert.ok(listed.items.some(({ id, status }) => id === "case-pending" && status === "Submitted"));
	const detail = await getCodSpecialCase({ db: fixture.db, userId: "cod-new", caseId: "case-pending" });
	assert.equal(detail.submittedByUserId, "lecturer-user-1");
	assert.deepEqual(detail.evidence.map(({ id, originalName }) => [id, originalName]), [["evidence-1", "supporting-document.pdf"]]);
	assert.equal(fixture.getEvidenceReads(), 1);
});

test("former COD cannot list, open, read evidence for, or decide departmental special cases after replacement", async () => {
	const fixture = replacementCaseDb();
	await designateDepartmentCod({ db: fixture.db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-new" });
	const listed = await listCodSpecialCases({ db: fixture.db, userId: "cod-old" });
	assert.equal(listed.items.length, 0);
	await assert.rejects(getCodSpecialCase({ db: fixture.db, userId: "cod-old", caseId: "case-pending" }), { statusCode: 404 });
	assert.equal(fixture.getEvidenceReads(), 0);
	await assert.rejects(decideSpecialCase({ db: fixture.db, userId: "cod-old", caseId: "case-pending", decision: "REJECT", reason: "Unauthorized former COD." }), { statusCode: 404 });
	assert.equal(fixture.submittedCase.status, "Submitted");
	assert.equal(fixture.outbox.some(({ eventType, recipientUserId }) => eventType === "COD_SPECIAL_CASE_OVERDUE" && recipientUserId === "cod-old"), false);
});

test("replacement COD can decide an existing submitted case without changing its submitter or submission details", async () => {
	const fixture = replacementCaseDb();
	const submittedBefore = structuredClone(fixture.submittedCase);
	const decidedBefore = structuredClone(fixture.decidedCase);
	const priorHistory = structuredClone(fixture.auditEntries);
	await designateDepartmentCod({ db: fixture.db, actorUserId: "admin-1", departmentId: "dept-1", codUserId: "cod-new" });
	const result = await decideSpecialCase({ db: fixture.db, userId: "cod-new", caseId: "case-pending", decision: "APPROVE", reason: "Reviewed by the replacement COD." });
	assert.equal(result.status, "Approved");
	assert.equal(fixture.submittedCase.submittedByUserId, submittedBefore.submittedByUserId);
	assert.equal(fixture.submittedCase.description, submittedBefore.description);
	assert.equal(fixture.submittedCase.categoryId, submittedBefore.categoryId);
	assert.equal(fixture.submittedCase.category, submittedBefore.category);
	assert.equal(fixture.submittedCase.reportId, submittedBefore.reportId);
	assert.equal(fixture.submittedCase.reviewDeadlineAt.valueOf(), submittedBefore.reviewDeadlineAt.valueOf());
	assert.equal(fixture.submittedCase.createdAt.valueOf(), submittedBefore.createdAt.valueOf());
	assert.equal(fixture.submittedCase.decisionByUserId, "cod-new");
	assert.deepEqual(fixture.auditEntries[0], priorHistory[0]);
	assert.equal(fixture.auditEntries.length, priorHistory.length + 2); // designation audit and new decision audit
	assert.deepEqual(fixture.decidedCase, decidedBefore);
});
