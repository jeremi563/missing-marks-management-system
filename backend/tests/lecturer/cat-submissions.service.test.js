import test from "node:test";
import assert from "node:assert/strict";

import {
	listLecturerCatSubmissions,
	getLecturerCatSubmission,
	decideLecturerCatSubmission,
} from "../../src/modules/lecturer/lecturer.service.js";

function fixture({ status = "PENDING_REVIEW", updateCount = 1 } = {}) {
	const state = {
		item: {
			id: "submission-1",
			status,
			rejectionReason: null,
			comments: null,
			assessment: {
				id: "assessment-1",
				type: "CAT",
				courseUnitId: "unit-1",
				courseUnit: { id: "unit-1", code: "IN101", name: "Computing" },
			},
			attendanceRecord: {
				id: "record-1",
				status: "PRESENT",
				locationVerified: true,
				recordedAt: new Date("2026-11-13T07:00:00.000Z"),
				session: {
					id: "session-1",
					sessionType: "CAT",
					lecturerProfileId: "lecturer-1",
					courseUnitId: "unit-1",
					startsAt: new Date("2026-11-13T06:00:00.000Z"),
					endsAt: new Date("2026-11-13T08:00:00.000Z"),
				},
			},
			student: {
				id: "student-1",
				studentNumber: "IN16/01234/26",
				user: { id: "student-user-1", displayName: "Student One" },
			},
		},
		updatedCount: updateCount,
		audit: [],
		outbox: [],
		calls: {},
	};
	const db = {
		lecturerProfile: { findUnique: async ({ where }) => {
			state.calls.lecturerWhere = where;
			return { id: "lecturer-1" };
		} },
		catSubmission: {
			findMany: async (args) => { state.calls.findMany = args; return [state.item]; },
			count: async (args) => { state.calls.count = args; return 1; },
			findFirst: async (args) => { state.calls.findFirst = args; return state.item; },
			updateMany: async ({ where, data }) => {
				state.calls.updateMany = { where, data };
				if (state.updatedCount === 1) Object.assign(state.item, data);
				return { count: state.updatedCount };
			},
			findUnique: async () => state.item,
		},
		auditLog: { create: async ({ data }) => { state.audit.push(data); return data; } },
		notificationOutbox: { create: async ({ data }) => { state.outbox.push(data); return data; } },
		$transaction: async (operation) => Array.isArray(operation)
			? Promise.all(operation)
			: operation(db),
	};
	return { db, state };
}

test("lecturer queue is scoped to the authenticated session owner and filters CAT submissions", async () => {
	const { db, state } = fixture();
	const result = await listLecturerCatSubmissions(db, "lecturer-user-1", {
		page: 2,
		limit: 5,
		status: "PENDING_REVIEW",
		courseUnitId: "unit-1",
		assessmentId: "assessment-1",
	});

	assert.equal(state.calls.lecturerWhere.userId, "lecturer-user-1");
	assert.equal(state.calls.findMany.where.status, "PENDING_REVIEW");
	assert.equal(state.calls.findMany.where.assessment.is.type, "CAT");
	assert.equal(state.calls.findMany.where.attendanceRecord.is.session.is.lecturerProfileId, "lecturer-1");
	assert.equal(state.calls.findMany.skip, 5);
	assert.equal(state.calls.findMany.take, 5);
	assert.equal(result.items.length, 1);
});

test("lecturer detail hides submissions owned by another lecturer", async () => {
	const { db, state } = fixture();
	state.item.attendanceRecord.session.lecturerProfileId = "other-lecturer";
	db.catSubmission.findFirst = async ({ where }) => {
		state.calls.findFirst = where;
		return null;
	};
	await assert.rejects(getLecturerCatSubmission(db, "lecturer-user-1", "submission-1"), { statusCode: 404 });
	assert.equal(state.calls.findFirst.attendanceRecord.is.session.is.lecturerProfileId, "lecturer-1");
});

test("lecturer can verify a pending submission with optional comments and notification", async () => {
	const { db, state } = fixture();
	const result = await decideLecturerCatSubmission(db, "lecturer-user-1", "submission-1", {
		decision: "VERIFY",
		comments: "Matched the submitted paper.",
	});

	assert.equal(result.status, "VERIFIED");
	assert.equal(result.verifiedByLecturerId, "lecturer-1");
	assert.ok(result.verifiedAt instanceof Date);
	assert.equal(result.comments, "Matched the submitted paper.");
	assert.equal(state.calls.updateMany.where.status, "PENDING_REVIEW");
	assert.equal(state.audit[0].action, "CAT_SUBMISSION_VERIFIED");
	assert.equal(state.outbox[0].recipientUserId, "student-user-1");
	assert.equal(state.outbox[0].eventType, "CAT_SUBMISSION_VERIFIED");
});

test("lecturer rejection requires and records the reason", async () => {
	const { db, state } = fixture();
	const result = await decideLecturerCatSubmission(db, "lecturer-user-1", "submission-1", {
		decision: "REJECT",
		reason: "  The submitted work is not legible.  ",
	});

	assert.equal(result.status, "REJECTED");
	assert.equal(result.rejectionReason, "The submitted work is not legible.");
	assert.equal(state.audit[0].action, "CAT_SUBMISSION_REJECTED");
	assert.match(state.outbox[0].message, /The submitted work is not legible/);
});

test("a concurrent decision loses the conditional update and writes no audit or notification", async () => {
	const { db, state } = fixture({ updateCount: 0 });
	await assert.rejects(
		decideLecturerCatSubmission(db, "lecturer-user-1", "submission-1", { decision: "VERIFY" }),
		{ statusCode: 409 },
	);
	assert.equal(state.audit.length, 0);
	assert.equal(state.outbox.length, 0);
});

test("invalid assessment/session relationships are not exposed or reviewable", async () => {
	const { db, state } = fixture();
	state.item.assessment.courseUnitId = "other-unit";
	await assert.rejects(getLecturerCatSubmission(db, "lecturer-user-1", "submission-1"), { statusCode: 404 });
});
