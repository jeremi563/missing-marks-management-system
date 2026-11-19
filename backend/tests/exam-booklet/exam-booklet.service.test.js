import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const {
	allocateExamBooklets,
	listStudentExamBooklets,
	manualLookupExamBooklet,
	previewInvigilatorExamBooklet,
	replaceExamBooklet,
	scanInvigilatorExamBooklet,
	scanStudentExamBooklet,
} = await import("../../src/modules/exam-booklet/exam-booklet.service.js");

const token = "ab".repeat(32);
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date("2026-11-15T12:00:00.000Z");

function fixture({ booklet: bookletOverrides = {}, record = null, session: sessionOverrides = {}, enrolled = true } = {}) {
	const state = {
		session: {
			id: "session-1",
			courseUnitId: "unit-1",
			lecturerProfileId: "lecturer-1",
			assessmentId: "assessment-1",
			sessionType: "EXAM",
			status: "active",
			startsAt: new Date("2026-11-15T11:00:00.000Z"),
			endsAt: new Date("2026-11-15T13:00:00.000Z"),
			lateGraceMinutes: 10,
			courseUnit: { id: "unit-1", code: "IN101", name: "Computing", departmentId: "department-1", department: { designatedCodUserId: "cod-user-1" } },
			assessment: { id: "assessment-1", code: "EXAM", name: "Final examination", type: "EXAM", courseUnitId: "unit-1" },
			...sessionOverrides,
		},
		student: { id: "student-1", studentNumber: "IN16/01234/26", user: { id: "student-user-1", displayName: "Student One" } },
		booklet: {
			id: "booklet-1",
			bookletIdentifier: "booklet-ref-1",
			studentProfileId: "student-1",
			assessmentId: "assessment-1",
			sessionId: "session-1",
			tokenHash,
			retiredTokenHash: null,
			status: "ALLOCATED",
			verifiedAt: null,
			verifiedByUserId: null,
			verificationMethod: null,
			student: { id: "student-1", studentNumber: "IN16/01234/26", user: { id: "student-user-1", displayName: "Student One" } },
			assessment: { id: "assessment-1", code: "EXAM", name: "Final examination", type: "EXAM" },
			session: null,
			...bookletOverrides,
		},
		record,
		scans: [],
		audits: [],
		outbox: [],
		booklets: [],
		history: [],
		failAudit: false,
	};
	state.booklet.session = state.session;
	let transactionTail = Promise.resolve();
	const db = {
		studentProfile: {
			findUnique: async ({ where }) => (where.userId === "student-user-1" || where.studentNumber === state.student.studentNumber) ? state.student : null,
		},
		lecturerProfile: {
			findUnique: async ({ where }) => where.userId === "lecturer-user-1" ? { id: "lecturer-1" } : { id: "other-lecturer" },
		},
		attendanceSession: {
			findUnique: async ({ where }) => where.id === state.session.id ? state.session : null,
		},
		unitEnrollment: {
			findFirst: async () => enrolled ? { id: "enrollment-1" } : null,
			findMany: async () => [{ studentProfileId: "student-1", student: state.student }],
		},
		examBooklet: {
			findFirst: async ({ where }) => {
				if (where.OR) {
					const [current, retired] = where.OR;
					if ((current?.tokenHash && current.tokenHash === state.booklet.tokenHash) || (retired?.retiredTokenHash && retired.retiredTokenHash === state.booklet.retiredTokenHash)) return state.booklet;
					return null;
				}
				if (where.studentProfileId && where.assessmentId && where.sessionId) {
					return state.booklet.studentProfileId === where.studentProfileId
						&& state.booklet.assessmentId === where.assessmentId
						&& state.booklet.sessionId === where.sessionId
						&& ["ALLOCATED", "VERIFIED"].includes(state.booklet.status)
						? state.booklet : null;
				}
				return null;
			},
			findUnique: async ({ where }) => where.id === state.booklet.id ? state.booklet : null,
			findMany: async ({ where }) => {
				if (where.tokenHash?.in) return state.booklets.filter((row) => where.tokenHash.in.includes(row.tokenHash));
				if (where.studentProfileId?.in) return state.booklets.filter((row) => where.studentProfileId.in.includes(row.studentProfileId)).map((row) => ({ ...row, student: state.student }));
				return state.booklets.map((row) => ({ ...row, student: state.student }));
			},
			createMany: async ({ data }) => {
				state.booklets.push(...data.map((row) => ({ id: `booklet-${state.booklets.length + 1}`, ...row })));
				return { count: data.length };
			},
			create: async ({ data }) => {
				const created = { ...data, id: data.id || `booklet-${state.booklets.length + 1}` };
				state.booklets.push(created);
				return created;
			},
			updateMany: async ({ where, data }) => {
				const target = [state.booklet, ...state.booklets].find(({ id, status, tokenHash: storedToken }) =>
					id === where.id && status === where.status && (where.tokenHash === undefined || storedToken === where.tokenHash));
				if (!target) return { count: 0 };
				Object.assign(target, data);
				return { count: 1 };
			},
		},
		attendanceRecord: {
			findUnique: async () => state.record,
			createMany: async ({ data }) => {
				if (!state.record) state.record = { id: "attendance-1", ...data[0] };
				return { count: 1 };
			},
			updateMany: async ({ where, data }) => {
				if (!state.record || state.record.id !== where.id || state.record.examVerificationStatus !== where.examVerificationStatus) return { count: 0 };
				Object.assign(state.record, data);
				return { count: 1 };
			},
		},
		attendanceHistory: {
			createMany: async ({ data }) => { state.history.push(...data); return { count: data.length }; },
		},
		examBookletScan: {
			create: async ({ data }) => {
				const row = { id: `scan-${state.scans.length + 1}`, ...data };
				state.scans.push(row);
				return { id: row.id };
			},
			findMany: async () => state.scans,
			count: async () => state.scans.length,
		},
		auditLog: {
			create: async ({ data }) => {
				if (state.failAudit) throw new Error("audit unavailable");
				state.audits.push(data);
				return data;
			},
		},
		notificationOutbox: { create: async ({ data }) => { state.outbox.push(data); return data; } },
		user: { findFirst: async () => ({ id: "cod-user-1" }) },
		$transaction: (operation) => {
			if (Array.isArray(operation)) return Promise.all(operation);
			const run = transactionTail.then(async () => {
				const snapshot = structuredClone(state);
				try {
					return await operation(db);
				} catch (error) {
					Object.assign(state, snapshot);
					throw error;
				}
			});
			transactionTail = run.catch(() => {});
			return run;
		},
	};
	return { db, state };
}

test("student scans their own allocated booklet and attendance is verified with the student actor, method, audit and notification", async () => {
	const { db, state } = fixture();
	const result = await scanStudentExamBooklet(db, "student-user-1", { sessionId: "session-1", token }, now);

	assert.equal(result.status, "VERIFIED");
	assert.equal(result.examVerificationStatus, "VERIFIED");
	assert.equal(state.booklet.status, "VERIFIED");
	assert.equal(state.record.examVerificationMethod, "STUDENT_SCAN");
	assert.equal(state.record.examVerificationActorUserId, "student-user-1");
	assert.equal(state.record.examVerifiedByLecturerId, undefined);
	assert.equal(state.record.examVerificationActorAt.getTime(), now.getTime());
	assert.equal(state.scans[0].outcome, "SUCCESS");
	assert.equal(state.audits[0].action, "EXAM_BOOKLET_VERIFIED");
	assert.equal(state.outbox[0].recipientUserId, "student-user-1");
	assert.equal(state.history.length, 1);
});

test("student scanning another student's booklet is rejected, audited and does not verify attendance", async () => {
	const { db, state } = fixture({ booklet: { studentProfileId: "other-student" } });
	await assert.rejects(scanStudentExamBooklet(db, "student-user-1", { sessionId: "session-1", token }, now), { statusCode: 403 });
	assert.equal(state.booklet.status, "ALLOCATED");
	assert.equal(state.record, null);
	assert.equal(state.scans[0].exceptionCode, "WRONG_STUDENT");
	assert.equal(state.audits[0].action, "EXAM_BOOKLET_SCAN_REJECTED");
});

test("authorized invigilator scan records the lecturer identity and does not fill the lecturer decision foreign key", async () => {
	const { db, state } = fixture();
	const result = await scanInvigilatorExamBooklet(db, "lecturer-user-1", "session-1", { token, identityConfirmed: true }, now);
	assert.equal(result.status, "VERIFIED");
	assert.equal(state.record.examVerificationMethod, "INVIGILATOR_SCAN");
	assert.equal(state.record.examVerificationActorUserId, "lecturer-user-1");
	assert.equal(state.record.examVerifiedByLecturerId, undefined);
	assert.equal(state.scans[0].scannerRole, "lecturer");
});

test("booklet verification preserves a prior lecturer decision actor and timestamp", async () => {
	const lecturerDecisionAt = new Date("2026-11-15T11:30:00.000Z");
	const { db, state } = fixture({
		record: {
			id: "attendance-1",
			status: "PRESENT",
			examVerificationStatus: "VERIFIED",
			examVerifiedByLecturerId: "lecturer-1",
			examVerifiedAt: lecturerDecisionAt,
		},
	});
	await scanStudentExamBooklet(db, "student-user-1", { sessionId: "session-1", token }, now);
	assert.equal(state.record.examVerifiedByLecturerId, "lecturer-1");
	assert.equal(state.record.examVerifiedAt, lecturerDecisionAt);
	assert.equal(state.record.examVerificationMethod, "STUDENT_SCAN");
	assert.equal(state.record.examVerificationActorUserId, "student-user-1");
});

test("unauthorized invigilator cannot scan a session they do not own", async () => {
	const { db, state } = fixture({
		session: { lecturerProfileId: "different-lecturer" },
	});
	await assert.rejects(scanInvigilatorExamBooklet(db, "lecturer-user-1", "session-1", { token, identityConfirmed: true }, now), { statusCode: 404 });
	assert.equal(state.scans.length, 0);
	assert.equal(state.record, null);
});

test("invalid and replaced QR tokens are rejected and logged without verifying attendance", async () => {
	const invalid = fixture();
	await assert.rejects(scanStudentExamBooklet(invalid.db, "student-user-1", { sessionId: "session-1", token: "cd".repeat(32) }, now), { statusCode: 404 });
	assert.equal(invalid.state.scans[0].exceptionCode, "INVALID_QR");

	const replaced = fixture({ booklet: { status: "REPLACED", tokenHash: null, retiredTokenHash: tokenHash } });
	await assert.rejects(scanStudentExamBooklet(replaced.db, "student-user-1", { sessionId: "session-1", token }, now), { statusCode: 409 });
	assert.equal(replaced.state.scans[0].exceptionCode, "REPLACED_BOOKLET");
	assert.equal(replaced.state.record, null);
});

test("wrong examination, inactive session, missing enrollment and duplicate scan are handled distinctly", async () => {
	const wrongExam = fixture({ booklet: { sessionId: "session-2", assessmentId: "assessment-2" } });
	await assert.rejects(scanStudentExamBooklet(wrongExam.db, "student-user-1", { sessionId: "session-1", token }, now), { statusCode: 409 });
	assert.equal(wrongExam.state.scans[0].exceptionCode, "WRONG_EXAM");

	const inactive = fixture({ session: { status: "completed" } });
	await assert.rejects(scanStudentExamBooklet(inactive.db, "student-user-1", { sessionId: "session-1", token }, now), { statusCode: 409 });
	assert.equal(inactive.state.scans[0].exceptionCode, "INACTIVE_SESSION");

	const expired = fixture({ session: { endsAt: new Date(now.valueOf() - 10 * 60_000) } });
	await assert.rejects(scanStudentExamBooklet(expired.db, "student-user-1", { sessionId: "session-1", token }, now), { statusCode: 409 });
	assert.equal(expired.state.scans[0].exceptionCode, "INACTIVE_SESSION");

	const notEnrolled = fixture({ enrolled: false });
	await assert.rejects(scanStudentExamBooklet(notEnrolled.db, "student-user-1", { sessionId: "session-1", token }, now), { statusCode: 403 });
	assert.equal(notEnrolled.state.scans[0].exceptionCode, "NOT_ENROLLED");

	const duplicate = fixture();
	await scanStudentExamBooklet(duplicate.db, "student-user-1", { sessionId: "session-1", token }, now);
	const repeated = await scanStudentExamBooklet(duplicate.db, "student-user-1", { sessionId: "session-1", token }, now);
	assert.equal(repeated.duplicate, true);
	assert.equal(duplicate.state.scans[1].outcome, "DUPLICATE");
	assert.equal(duplicate.state.scans.filter(({ outcome }) => outcome === "SUCCESS").length, 1);
});

test("booklet verification remains available only through the configured post-end grace window", async () => {
	const withinGrace = fixture({
		session: { endsAt: new Date(now.valueOf() - 5 * 60_000), lateGraceMinutes: 10 },
	});
	const result = await scanStudentExamBooklet(withinGrace.db, "student-user-1", { sessionId: "session-1", token }, now);
	assert.equal(result.status, "VERIFIED");
	assert.equal(withinGrace.state.booklet.status, "VERIFIED");
	assert.equal(withinGrace.state.record.status, "LATE");

	const completedWithinGrace = fixture({
		session: {
			status: "completed",
			endsAt: new Date(now.valueOf() - 20 * 60_000),
			updatedAt: new Date(now.valueOf() - 5 * 60_000),
			lateGraceMinutes: 10,
		},
	});
	await scanInvigilatorExamBooklet(
		completedWithinGrace.db,
		"lecturer-user-1",
		"session-1",
		{ token, identityConfirmed: true },
		now,
	);
	assert.equal(completedWithinGrace.state.booklet.status, "VERIFIED");
	assert.equal(completedWithinGrace.state.record.status, "LATE");

	const absentWithinGrace = fixture({
		session: {
			status: "completed",
			endsAt: new Date(now.valueOf() - 20 * 60_000),
			updatedAt: new Date(now.valueOf() - 5 * 60_000),
			lateGraceMinutes: 10,
		},
		record: {
			id: "attendance-1",
			status: "ABSENT",
			examVerificationStatus: "PENDING_REVIEW",
		},
	});
	await scanInvigilatorExamBooklet(
		absentWithinGrace.db,
		"lecturer-user-1",
		"session-1",
		{ token, identityConfirmed: true },
		now,
	);
	assert.equal(absentWithinGrace.state.record.status, "LATE");
	assert.equal(absentWithinGrace.state.record.examVerificationStatus, "VERIFIED");
	assert.equal(absentWithinGrace.state.history[0].status, "LATE");

	const outsideGrace = fixture({
		session: {
			status: "completed",
			endsAt: new Date(now.valueOf() - 20 * 60_000),
			updatedAt: new Date(now.valueOf() - 10 * 60_000),
			lateGraceMinutes: 10,
		},
	});
	await assert.rejects(
		previewInvigilatorExamBooklet(outsideGrace.db, "lecturer-user-1", "session-1", token, now),
		{ statusCode: 409 },
	);
	assert.equal(outsideGrace.state.scans[0].exceptionCode, "INACTIVE_SESSION");
});

test("concurrent scans produce one successful verification and one safe duplicate result", async () => {
	const { db, state } = fixture();
	const results = await Promise.all([
		scanStudentExamBooklet(db, "student-user-1", { sessionId: "session-1", token }, now),
		scanStudentExamBooklet(db, "student-user-1", { sessionId: "session-1", token }, now),
	]);
	assert.equal(results.filter(({ duplicate }) => !duplicate).length, 1);
	assert.equal(results.filter(({ duplicate }) => duplicate).length, 1);
	assert.equal(state.scans.filter(({ outcome }) => outcome === "SUCCESS").length, 1);
	assert.equal(state.scans.filter(({ outcome }) => outcome === "DUPLICATE").length, 1);
});

test("manual lookup verifies a damaged QR only after explicit confirmation and retains its exception marker", async () => {
	const { db, state } = fixture();
	const result = await manualLookupExamBooklet(db, "lecturer-user-1", "session-1", {
		studentNumber: "IN16/01234/26",
		identityConfirmed: true,
	}, now);
	assert.equal(result.status, "VERIFIED");
	assert.equal(state.scans[0].exceptionCode, "DAMAGED_QR_MANUAL");
	assert.equal(state.scans[0].scanMethod, "INVIGILATOR_SCAN");
});

test("manual lookup logs missing allocations, and invalid invigilator previews are audited", async () => {
	const missing = fixture();
	missing.db.examBooklet.findFirst = async () => null;
	await assert.rejects(manualLookupExamBooklet(missing.db, "lecturer-user-1", "session-1", {
		studentNumber: "IN16/01234/26",
		identityConfirmed: true,
	}, now), { statusCode: 404 });
	assert.equal(missing.state.scans[0].exceptionCode, "MISSING_ALLOCATION");
	assert.equal(missing.state.record, null);

	const invalidPreview = fixture();
	await assert.rejects(previewInvigilatorExamBooklet(invalidPreview.db, "lecturer-user-1", "session-1", "cd".repeat(32), now), { statusCode: 404 });
	assert.equal(invalidPreview.state.scans[0].exceptionCode, "INVALID_QR");
});

test("replacement retires the old hash, preserves the old booklet and returns a fresh one-time token", async () => {
	const { db, state } = fixture();
	const result = await replaceExamBooklet(db, "lecturer-user-1", "lecturer", "booklet-1", "QR damaged", now);
	assert.equal(result.originalBookletId, "booklet-1");
	assert.equal(state.booklet.status, "REPLACED");
	assert.equal(state.booklet.tokenHash, null);
	assert.equal(state.booklet.retiredTokenHash, tokenHash);
	assert.equal(state.booklet.replacementReason, "QR damaged");
	assert.equal(state.booklet.replacementApprovedByUserId, "lecturer-user-1");
	assert.equal(state.booklets[0].status, "ALLOCATED");
	assert.equal(result.qrToken.length, 64);
	assert.equal(state.audits[0].action, "EXAM_BOOKLET_REPLACED");
});

test("only the designated active departmental COD may approve replacement", async () => {
	const { db } = fixture();
	await assert.rejects(replaceExamBooklet(db, "other-cod-user", "cod", "booklet-1", "QR damaged", now), { statusCode: 404 });
});

test("a failed audit write rolls back the booklet, attendance and scan ledger updates", async () => {
	const { db, state } = fixture();
	state.failAudit = true;
	await assert.rejects(scanStudentExamBooklet(db, "student-user-1", { sessionId: "session-1", token }, now), /audit unavailable/);
	assert.equal(state.booklet.status, "ALLOCATED");
	assert.equal(state.record, null);
	assert.deepEqual(state.scans, []);
	assert.deepEqual(state.outbox, []);
});

test("booklet allocation returns a one-time random token while the stored value is only its hash", async () => {
	const { db, state } = fixture();
	const result = await allocateExamBooklets(db, "lecturer-user-1", "session-1");
	assert.equal(result.newlyAllocatedCount, 1);
	const allocation = result.allocations[0];
	assert.equal(allocation.qrToken.length, 64);
	assert.notEqual(allocation.qrToken, state.booklets[0].tokenHash);
	assert.equal(createHash("sha256").update(allocation.qrToken).digest("hex"), state.booklets[0].tokenHash);
	assert.equal(allocation.student.studentNumber, "IN16/01234/26");
});

test("booklet allocation accepts legacy exam assessment capitalization", async () => {
	const { db } = fixture({
		session: {
			assessment: {
				id: "assessment-1",
				code: "EXAM",
				name: "Final examination",
				type: "Exam",
				courseUnitId: "unit-1",
			},
		},
	});
	const result = await allocateExamBooklets(db, "lecturer-user-1", "session-1");
	assert.equal(result.newlyAllocatedCount, 1);
});

test("students can retrieve only their own booklet allocations", async () => {
	const { db } = fixture();
	db.examBooklet.findMany = async () => [{ id: "booklet-1", studentProfileId: "student-1" }];
	const items = await listStudentExamBooklets(db, "student-user-1");
	assert.deepEqual(items, [{ id: "booklet-1", studentProfileId: "student-1" }]);
});
