import test from "node:test";
import assert from "node:assert/strict";
import {
	acknowledgeSpecialCaseSchedule,
	cancelSpecialCase,
	decideSpecialCase,
	recordSpecialCaseAttendance,
	rescheduleSpecialCase,
	saveCodSpecialCaseSchedulingConfig,
	scheduleSpecialCase,
} from "../../src/shared/services/feature5.service.js";

const now = new Date("2026-03-01T10:00:00.000Z");
const period = { startsAt: new Date("2025-09-01T00:00:00.000Z") };

function codDecisionDb({ schedulingDays = 3, hasRecommendation = true } = {}) {
	const writes = { audits: [], notifications: [], reviews: [], updates: [] };
	const caseRecord = {
		id: "case-1",
		reportId: null,
		studentProfileId: "student-profile-1",
		courseUnitId: "unit-1",
		academicPeriodId: "period-1",
		status: "PENDING_COD_REVIEW",
		administrativeResolutionRequired: false,
		student: { userId: "student-user-1" },
		courseUnit: { department: { id: "department-1", designatedCodUserId: "cod-user-1" } },
		academicPeriod: period,
	};
	const tx = {
		$queryRaw: async () => [{ id: "department-1" }],
		user: { findFirst: async () => ({ id: "cod-user-1" }) },
		department: { findUnique: async () => ({ id: "department-1", designatedCodUserId: "cod-user-1" }) },
		specialCase: {
			findUnique: async () => caseRecord,
			updateMany: async ({ data }) => {
				writes.updates.push(data);
				Object.assign(caseRecord, data);
				return { count: 1 };
			},
		},
		specialCaseReview: {
			findFirst: async () => hasRecommendation ? { id: "lecturer-review-1", reviewerUserId: "lecturer-user-1" } : null,
			create: async ({ data }) => { writes.reviews.push(data); return data; },
		},
		specialCaseDepartmentConfig: {
			findUnique: async () => schedulingDays == null ? null : { schedulingDays },
		},
		courseUnitLecturer: {
			findMany: async () => [{ lecturer: { userId: "lecturer-user-1" } }],
			findFirst: async () => ({ id: "assignment-1" }),
		},
		notificationOutbox: { create: async ({ data }) => { writes.notifications.push(data); return data; } },
		auditLog: { create: async ({ data }) => { writes.audits.push(data); return data; } },
	};
	return { db: { $transaction: async (callback) => callback(tx) }, writes, caseRecord };
}

function schedulingDb(initialStatus = "PENDING_SCHEDULING") {
	const writes = { audits: [], notifications: [], reviews: [], attendances: [] };
	const caseRecord = {
		id: "case-1",
		reportId: null,
		studentProfileId: "student-profile-1",
		courseUnitId: "unit-1",
		academicPeriodId: "period-1",
		status: initialStatus,
		administrativeResolutionRequired: false,
		schedulingDeadlineAt: new Date("2026-03-20T10:00:00.000Z"),
		authorizedReschedules: 0,
		student: { userId: "student-user-1" },
		academicPeriod: period,
	};
	const schedules = [];
	const tx = {
		$queryRaw: async () => [{ id: caseRecord.id }],
		lecturerProfile: { findUnique: async () => ({ id: "lecturer-profile-1" }) },
		courseUnitLecturer: { findFirst: async () => ({ id: "assignment-1" }) },
		studentProfile: { findUnique: async () => ({ id: "student-profile-1" }) },
		specialCase: {
			findUnique: async () => caseRecord,
			findFirst: async ({ where }) => where.id === caseRecord.id && where.studentProfileId === "student-profile-1"
				? { id: caseRecord.id, status: caseRecord.status }
				: null,
			updateMany: async ({ data }) => { Object.assign(caseRecord, data); return { count: 1 }; },
			update: async ({ data }) => {
				if (data.authorizedReschedules) caseRecord.authorizedReschedules += data.authorizedReschedules.increment;
				else Object.assign(caseRecord, data);
				return caseRecord;
			},
		},
		specialCaseSchedule: {
			findFirst: async ({ where }) => schedules
				.filter((item) => item.specialCaseId === where.specialCaseId && (!where.status || item.status === where.status))
				.sort((left, right) => right.version - left.version)[0] ?? null,
			create: async ({ data }) => {
				const schedule = { id: `schedule-${schedules.length + 1}`, status: "SCHEDULED", acknowledgedAt: null, ...data };
				schedules.push(schedule);
				return schedule;
			},
			updateMany: async ({ where, data }) => {
				const schedule = schedules.find((item) => item.id === where.id && (!where.status || item.status === where.status));
				if (!schedule) return { count: 0 };
				Object.assign(schedule, data);
				return { count: 1 };
			},
		},
		specialCaseAttendance: {
			findUnique: async ({ where }) => writes.attendances.find(({ scheduleId }) => scheduleId === where.scheduleId) ?? null,
			create: async ({ data }) => {
				const attendance = { id: `attendance-${writes.attendances.length + 1}`, ...data };
				writes.attendances.push(attendance);
				return attendance;
			},
		},
		specialCaseReview: { create: async ({ data }) => { writes.reviews.push(data); return data; } },
		notificationOutbox: { create: async ({ data }) => { writes.notifications.push(data); return data; } },
		auditLog: { create: async ({ data }) => { writes.audits.push(data); return data; } },
	};
	return { db: { $transaction: async (callback) => callback(tx) }, writes, caseRecord, schedules };
}

test("COD approval requires a department scheduling configuration and uses its deadline", async (t) => {
	await t.test("does not approve without configuration", async () => {
		const { db, writes } = codDecisionDb({ schedulingDays: null });
		await assert.rejects(decideSpecialCase({
			db,
			userId: "cod-user-1",
			caseId: "case-1",
			decision: "APPROVE",
			reason: "Approved.",
			now,
		}), { statusCode: 409 });
		assert.equal(writes.updates.length, 0);
	});

	await t.test("records approval, deadline, audit, and scheduling notifications", async () => {
		const { db, writes, caseRecord } = codDecisionDb({ schedulingDays: 4 });
		const result = await decideSpecialCase({
			db,
			userId: "cod-user-1",
			caseId: "case-1",
			decision: "APPROVE",
			reason: "Approved after review.",
			now,
		});
		assert.equal(result.status, "PENDING_SCHEDULING");
		assert.equal(result.schedulingDeadlineAt.valueOf(), now.valueOf() + 4 * 86400000);
		assert.equal(caseRecord.status, "PENDING_SCHEDULING");
		assert.equal(writes.reviews[0].reviewerRole, "COD");
		assert.ok(writes.audits.some(({ action }) => action === "SPECIAL_CASE_COD_APPROVE"));
		assert.ok(writes.notifications.some(({ eventType }) => eventType === "SPECIAL_CASE_ASSESSMENT_SCHEDULED" || eventType === "SPECIAL_CASE_COD_DECISION"));
	});

	await t.test("cannot make a final decision without a lecturer recommendation", async () => {
		const { db, writes } = codDecisionDb({ hasRecommendation: false });
		await assert.rejects(decideSpecialCase({
			db,
			userId: "cod-user-1",
			caseId: "case-1",
			decision: "REJECT",
			reason: "Rejected.",
			now,
		}), { statusCode: 409 });
		assert.equal(writes.updates.length, 0);
	});
});

test("COD scheduling configuration is validated, department-scoped, and audited", async (t) => {
	await t.test("rejects out-of-range values", async () => {
		await assert.rejects(saveCodSpecialCaseSchedulingConfig({
			db: {},
			userId: "cod-user-1",
			departmentId: "department-1",
			schedulingDays: 0,
		}), { statusCode: 422 });
	});

	await t.test("saves configuration and audit record for its designated COD", async () => {
		const writes = { audits: [] };
		const tx = {
			$queryRaw: async () => [{ id: "department-1" }],
			user: { findFirst: async () => ({ id: "cod-user-1" }) },
			department: { findUnique: async () => ({ id: "department-1", name: "Computing", code: "COMP", designatedCodUserId: "cod-user-1" }) },
			specialCaseDepartmentConfig: {
				findUnique: async () => ({ schedulingDays: 5 }),
				upsert: async () => ({ departmentId: "department-1", schedulingDays: 8, updatedByUserId: "cod-user-1", updatedAt: now }),
			},
			auditLog: { create: async ({ data }) => { writes.audits.push(data); return data; } },
		};
		const result = await saveCodSpecialCaseSchedulingConfig({
			db: { $transaction: async (callback) => callback(tx) },
			userId: "cod-user-1",
			departmentId: "department-1",
			schedulingDays: 8,
		});
		assert.equal(result.schedulingDays, 8);
		assert.equal(writes.audits[0].action, "SPECIAL_CASE_SCHEDULING_CONFIG_UPDATED");
	});
});

test("schedule history, student acknowledgement, and explicit attendance are separate transitions", async () => {
	const { db, writes, caseRecord, schedules } = schedulingDb();
	const firstSchedule = await scheduleSpecialCase({
		db,
		userId: "lecturer-user-1",
		caseId: "case-1",
		startsAt: "2026-03-05T10:00:00.000Z",
		endsAt: "2026-03-05T12:00:00.000Z",
		venue: "Hall A",
		now,
	});
	assert.equal(caseRecord.status, "SCHEDULED");
	assert.equal(firstSchedule.version, 1);
	assert.ok(writes.audits.some(({ action }) => action === "SPECIAL_CASE_ASSESSMENT_SCHEDULED"));

	await rescheduleSpecialCase({
		db,
		userId: "lecturer-user-1",
		caseId: "case-1",
		startsAt: "2026-03-08T10:00:00.000Z",
		endsAt: "2026-03-08T12:00:00.000Z",
		venue: "Hall B",
		reason: "Venue became unavailable.",
		now,
	});
	assert.equal(schedules[0].status, "RESCHEDULED");
	assert.equal(schedules[1].version, 2);
	assert.equal(schedules[1].acknowledgedAt, null);
	assert.equal(schedules[1].supersedesScheduleId, schedules[0].id);

	await acknowledgeSpecialCaseSchedule({ db, userId: "student-user-1", caseId: "case-1", now });
	assert.equal(schedules[1].acknowledgedAt, now);
	assert.equal(caseRecord.status, "SCHEDULED");
	assert.equal(writes.attendances.length, 0);

	await recordSpecialCaseAttendance({
		db,
		userId: "lecturer-user-1",
		caseId: "case-1",
		outcome: "ATTENDED",
		remarks: "Present.",
		now: new Date("2026-03-08T12:01:00.000Z"),
	});
	assert.equal(caseRecord.status, "COMPLETED");
	assert.equal(writes.attendances[0].outcome, "ATTENDED");
	assert.ok(writes.audits.some(({ action }) => action === "SPECIAL_CASE_ATTENDANCE_RECORDED"));
	assert.equal("marks" in writes, false);
});

test("lecturer cannot schedule after the departmental deadline and cancellation is audited", async (t) => {
	await t.test("rejects an overdue schedule", async () => {
		const { db, writes } = schedulingDb();
		await assert.rejects(scheduleSpecialCase({
			db,
			userId: "lecturer-user-1",
			caseId: "case-1",
			startsAt: "2026-03-25T10:00:00.000Z",
			endsAt: "2026-03-25T12:00:00.000Z",
			venue: "Hall A",
			now: new Date("2026-03-21T00:00:00.000Z"),
		}), { statusCode: 409 });
		assert.equal(writes.audits.length, 0);
	});

	await t.test("cancels approved case with a recorded reason", async () => {
		const { db, writes, caseRecord } = schedulingDb("PENDING_SCHEDULING");
		const result = await cancelSpecialCase({
			db,
			userId: "lecturer-user-1",
			caseId: "case-1",
			reason: "Assessment is no longer available.",
			now,
		});
		assert.equal(result.status, "CANCELLED");
		assert.equal(caseRecord.status, "CANCELLED");
		assert.ok(writes.audits.some(({ action }) => action === "SPECIAL_CASE_CANCELLED"));
	});
});
