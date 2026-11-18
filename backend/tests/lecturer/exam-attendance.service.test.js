import test from "node:test";
import assert from "node:assert/strict";

import {
	listLecturerExamAttendance,
	getLecturerExamAttendanceRecord,
	decideLecturerExamAttendance,
	decideLecturerExamAttendanceRecords,
} from "../../src/modules/lecturer/lecturer.service.js";

function fixture({ status = "PENDING_REVIEW", updateCount = 1 } = {}) {
	const state = {
		item: {
			id: "record-1",
			status: "PRESENT",
			locationVerified: true,
			recordedAt: new Date("2026-11-13T07:00:00.000Z"),
			examVerificationStatus: status,
			examVerifiedAt: null,
			examRejectionReason: null,
			examComments: null,
			student: { id: "student-1", studentNumber: "IN16/01234/26", user: { id: "student-user-1", displayName: "Student One" } },
			session: {
				id: "session-1",
				sessionType: "EXAM",
				lecturerProfileId: "lecturer-1",
				courseUnitId: "unit-1",
				startsAt: new Date("2026-11-13T06:00:00.000Z"),
				endsAt: new Date("2026-11-13T08:00:00.000Z"),
				courseUnit: { id: "unit-1", code: "IN101", name: "Computing" },
				classroom: { id: "classroom-1", name: "Room 1" },
				assessment: {
					id: "assessment-1",
					code: "EXAM",
					name: "Final Exam",
					type: "EXAM",
					courseUnitId: "unit-1",
					courseUnit: { id: "unit-1", code: "IN101", name: "Computing" },
				},
			},
		},
		items: [],
		updateCount,
		audit: [],
		outbox: [],
		calls: {},
	};
	state.items.push(state.item);
	const db = {
		lecturerProfile: {
			findUnique: async ({ where }) => {
				state.calls.lecturerWhere = where;
				return where.userId === "lecturer-user-1" ? { id: "lecturer-1" } : { id: "other-lecturer" };
			},
		},
		attendanceRecord: {
			findMany: async (args) => {
				state.calls.findMany = args;
				const ids = args.where.id?.in;
				return state.items.filter((item) => !ids || ids.includes(item.id));
			},
			count: async (args) => { state.calls.count = args; return 1; },
			findFirst: async (args) => {
				state.calls.findFirst = args;
				const item = state.items.find(({ id }) => id === args.where.id);
				return item?.session.lecturerProfileId === args.where.session.is.lecturerProfileId ? item : null;
			},
			updateMany: async ({ where, data }) => {
				state.calls.updateMany = [...(state.calls.updateMany ?? []), { where, data }];
				const item = state.items.find(({ id }) => id === where.id);
				if (state.updateCount === 1 && item) Object.assign(item, data);
				return { count: state.updateCount };
			},
			findUnique: async ({ where }) => state.items.find(({ id }) => id === where.id) ?? null,
		},
		auditLog: { create: async ({ data }) => { state.audit.push(data); return data; } },
		notificationOutbox: { create: async ({ data }) => { state.outbox.push(data); return data; } },
		$transaction: async (operation) => Array.isArray(operation)
			? Promise.all(operation)
			: operation(db),
	};
	return { db, state };
}

test("lecturer queue and details are scoped to EXAM sessions owned by the authenticated lecturer", async () => {
	const { db, state } = fixture();
	const result = await listLecturerExamAttendance(db, "lecturer-user-1", {
		page: 2, limit: 5, status: "PENDING_REVIEW", courseUnitId: "unit-1", assessmentId: "assessment-1",
	});
	assert.equal(state.calls.findMany.where.session.is.lecturerProfileId, "lecturer-1");
	assert.equal(state.calls.findMany.where.session.is.sessionType, "EXAM");
	assert.equal(state.calls.findMany.where.examVerificationStatus, "PENDING_REVIEW");
	assert.equal(state.calls.findMany.skip, 5);
	assert.equal(result.items.length, 1);

	state.item.session.lecturerProfileId = "other-lecturer";
	await assert.rejects(getLecturerExamAttendanceRecord(db, "lecturer-user-1", "record-1"), { statusCode: 404 });
	assert.equal(state.calls.findFirst.where.session.is.lecturerProfileId, "lecturer-1");
});

test("only EXAM attendance with a matching EXAM assessment is exposed", async () => {
	const { db, state } = fixture();
	state.item.session.assessment.type = "CAT";
	const result = await listLecturerExamAttendance(db, "lecturer-user-1", {});
	assert.deepEqual(result.items, []);
	await assert.rejects(getLecturerExamAttendanceRecord(db, "lecturer-user-1", "record-1"), { statusCode: 404 });
});

test("exam assessment matching accepts legacy capitalization", async () => {
	const { db, state } = fixture();
	state.item.session.assessment.type = "Exam";
	const result = await listLecturerExamAttendance(db, "lecturer-user-1", {});
	assert.equal(result.items.length, 1);
});

test("lecturer verification records reviewer, timestamp, audit and student notification", async () => {
	const { db, state } = fixture();
	const result = await decideLecturerExamAttendance(db, "lecturer-user-1", "record-1", {
		decision: "VERIFY",
		comments: "Matched the examination register.",
	});
	assert.equal(result.examVerificationStatus, "VERIFIED");
	assert.equal(result.examVerifiedByLecturerId, "lecturer-1");
	assert.ok(result.examVerifiedAt instanceof Date);
	assert.equal(result.examComments, "Matched the examination register.");
	assert.equal(state.calls.updateMany[0].where.examVerificationStatus, "PENDING_REVIEW");
	assert.equal(state.audit[0].action, "EXAM_ATTENDANCE_VERIFIED");
	assert.equal(state.outbox[0].recipientUserId, "student-user-1");
	assert.equal(state.outbox[0].eventType, "EXAM_ATTENDANCE_VERIFIED");
});

test("lecturer rejection records its mandatory reason and notifies the student", async () => {
	const { db, state } = fixture();
	const result = await decideLecturerExamAttendance(db, "lecturer-user-1", "record-1", {
		decision: "REJECT",
		reason: "  Not present on the examination register.  ",
	});
	assert.equal(result.examVerificationStatus, "REJECTED");
	assert.equal(result.examRejectionReason, "Not present on the examination register.");
	assert.equal(state.audit[0].action, "EXAM_ATTENDANCE_REJECTED");
	assert.match(state.outbox[0].message, /Not present on the examination register/);
});

test("decided records and concurrent decisions cannot be decided again", async () => {
	const alreadyDecided = fixture({ status: "VERIFIED" });
	await assert.rejects(
		decideLecturerExamAttendance(alreadyDecided.db, "lecturer-user-1", "record-1", { decision: "REJECT", reason: "No" }),
		{ statusCode: 409 },
	);

	const concurrent = fixture({ updateCount: 0 });
	await assert.rejects(
		decideLecturerExamAttendance(concurrent.db, "lecturer-user-1", "record-1", { decision: "VERIFY" }),
		{ statusCode: 409 },
	);
	assert.equal(concurrent.state.audit.length, 0);
	assert.equal(concurrent.state.outbox.length, 0);
});

test("lecturer can verify selected examination attendance records as one batch", async () => {
	const { db, state } = fixture();
	const second = structuredClone(state.item);
	second.id = "record-2";
	second.session.id = "session-2";
	second.student.id = "student-2";
	second.student.user.id = "student-user-2";
	state.items.push(second);

	const result = await decideLecturerExamAttendanceRecords(db, "lecturer-user-1", {
		recordIds: ["record-2", "record-1"],
		decision: "VERIFY",
		comments: "Matched the examination registers.",
	});

	assert.equal(result.count, 2);
	assert.deepEqual(result.records.map(({ id }) => id), ["record-2", "record-1"]);
	assert.equal(state.audit.length, 2);
	assert.equal(state.outbox.length, 2);
	assert.ok(state.items.every(({ examVerificationStatus }) => examVerificationStatus === "VERIFIED"));
	assert.ok(state.items.every(({ examComments }) => examComments === "Matched the examination registers."));
});

test("lecturer can reject selected examination attendance records with one reason", async () => {
	const { db, state } = fixture();
	const second = structuredClone(state.item);
	second.id = "record-2";
	second.session.id = "session-2";
	second.student.id = "student-2";
	second.student.user.id = "student-user-2";
	state.items.push(second);

	const result = await decideLecturerExamAttendanceRecords(db, "lecturer-user-1", {
		recordIds: ["record-1", "record-2"],
		decision: "REJECT",
		reason: "Not present on the examination register.",
	});

	assert.equal(result.count, 2);
	assert.ok(state.items.every(({ examVerificationStatus, examRejectionReason }) => (
		examVerificationStatus === "REJECTED"
		&& examRejectionReason === "Not present on the examination register."
	)));
	assert.equal(state.audit.length, 2);
	assert.equal(state.outbox.length, 2);
});

test("bulk exam decisions reject stale records before writing any decisions", async () => {
	const { db, state } = fixture();
	const second = structuredClone(state.item);
	second.id = "record-2";
	second.examVerificationStatus = "VERIFIED";
	state.items.push(second);

	await assert.rejects(
		decideLecturerExamAttendanceRecords(db, "lecturer-user-1", {
			recordIds: ["record-1", "record-2"],
			decision: "VERIFY",
		}),
		{ statusCode: 409 },
	);
	assert.equal(state.calls.updateMany, undefined);
	assert.equal(state.audit.length, 0);
	assert.equal(state.outbox.length, 0);
});

test("bulk exam decisions do not expose records outside the lecturer's scope", async () => {
	const { db, state } = fixture();
	db.attendanceRecord.findMany = async (args) => { state.calls.findMany = args; return []; };

	await assert.rejects(
		decideLecturerExamAttendanceRecords(db, "lecturer-user-1", {
			recordIds: ["record-1"],
			decision: "VERIFY",
		}),
		{ statusCode: 404 },
	);
	assert.equal(state.calls.updateMany, undefined);
	assert.equal(state.audit.length, 0);
	assert.equal(state.outbox.length, 0);
});

