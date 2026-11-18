import test from "node:test";
import assert from "node:assert/strict";
import {
	createAcademicPeriod,
	createCourse,
	createCourseUnit,
	deleteMapping,
	saveAcademicYearSchedule,
	updateAcademicPeriod,
	updateCourseUnit,
} from "../../src/modules/admin/academic.service.js";

const ids = {
	unit: "00000000-0000-4000-8000-000000000003",
};

test("admin creates a department course and audits it", async () => {
	let createdData;
	let auditEvent;
	const tx = {
		department: { findUnique: async ({ where }) => ({ id: where.id }) },
		course: { create: async ({ data }) => { createdData = data; return { id: "course-1", ...data }; } },
		auditLog: { create: async ({ data }) => { auditEvent = data; return data; } },
	};

	const result = await createCourse({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "admin-1",
		departmentId: "department-1",
		code: "16",
		name: "BSc Computing",
	});

	assert.deepEqual(createdData, { departmentId: "department-1", code: "16", name: "BSc Computing" });
	assert.equal(result.id, "course-1");
	assert.equal(auditEvent.action, "ADMIN_COURSE_CREATED");
});

test("admin can update a course unit and the change is audited", async () => {
	let updatedData;
	let auditEvent;
	const tx = {
		courseUnit: {
			findUnique: async () => ({
				id: ids.unit,
				departmentId: "department-1",
				courseId: null,
				_count: { enrollments: 0, reports: 0, attendanceSessions: 0, assessments: 0 },
			}),
			update: async ({ where, data }) => {
				assert.equal(where.id, ids.unit);
				updatedData = data;
				return { id: ids.unit, ...data };
			},
		},
		course: { findUnique: async ({ where }) => ({ id: where.id, departmentId: "department-2" }) },
		auditLog: { create: async ({ data }) => { auditEvent = data; return data; } },
	};
	const result = await updateCourseUnit({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "admin-1",
		id: ids.unit,
		code: "COMP202",
		name: "Advanced Foundations",
		courseId: "course-2",
	});

	assert.equal(result.id, ids.unit);
	assert.deepEqual(updatedData, { code: "COMP202", name: "Advanced Foundations", courseId: "course-2", departmentId: "department-2" });
	assert.equal(auditEvent.action, "ADMIN_COURSE_UNIT_UPDATED");
	assert.equal(auditEvent.entityId, ids.unit);
});

test("admin cannot move a course unit that already has academic history", async () => {
	const tx = {
		courseUnit: {
			findUnique: async () => ({
				id: ids.unit,
				departmentId: "department-1",
				courseId: "course-1",
				_count: { enrollments: 1, reports: 0, attendanceSessions: 0, assessments: 0 },
			}),
			update: async () => assert.fail("Course unit with history must not be moved"),
		},
		course: { findUnique: async ({ where }) => ({ id: where.id, departmentId: "department-2" }) },
	};

	await assert.rejects(updateCourseUnit({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "admin-1",
		id: ids.unit,
		courseId: "course-2",
	}), { statusCode: 409 });
});

test("admin creates a course unit under the selected course and derives its department", async () => {
	let createdData;
	let auditEvent;
	const tx = {
		course: { findUnique: async ({ where }) => ({ id: where.id, departmentId: "department-1" }) },
		courseUnit: { create: async ({ data }) => { createdData = data; return { id: ids.unit, ...data }; } },
		auditLog: { create: async ({ data }) => { auditEvent = data; return data; } },
	};

	const result = await createCourseUnit({
		db: { $transaction: (callback) => callback(tx) },
		actorUserId: "admin-1",
		courseId: "course-1",
		code: "IN101",
		name: "Introduction to Computing",
	});

	assert.deepEqual(createdData, { courseId: "course-1", code: "IN101", name: "Introduction to Computing", departmentId: "department-1" });
	assert.equal(result.departmentId, "department-1");
	assert.equal(auditEvent.action, "ADMIN_COURSE_UNIT_CREATED");
});

test("academic-period creation and update reject periods crossing Nairobi academic years", async () => {
	let created;
	const createTx = {
		academicPeriod: {
			create: async ({ data }) => { created = data; return data; },
		},
		auditLog: { create: async () => ({}) },
	};
	const db = { $transaction: async (operation) => operation(createTx) };
	await createAcademicPeriod({
		db,
		actorUserId: "admin-1",
		name: "Misleading 2020/21",
		startsAt: new Date("2026-09-01T00:00:00+03:00"),
		endsAt: new Date("2027-08-31T23:59:59+03:00"),
	});
	assert.equal(created.name, "Misleading 2020/21");
	await assert.rejects(createAcademicPeriod({
		db,
		actorUserId: "admin-1",
		name: "2026/27",
		startsAt: new Date("2026-09-01T00:00:00+03:00"),
		endsAt: new Date("2027-09-01T00:00:00+03:00"),
	}), { statusCode: 422 });

	const updateTx = {
		academicPeriod: {
			findUnique: async () => ({
				id: "period-1",
				startsAt: new Date("2026-09-01T00:00:00+03:00"),
				endsAt: new Date("2027-08-31T23:59:59+03:00"),
				enrollmentOpensAt: null,
				enrollmentClosesAt: null,
			}),
			update: async () => assert.fail("A spanning update must not be persisted"),
		},
		auditLog: { create: async () => ({}) },
	};
	await assert.rejects(updateAcademicPeriod({
		db: { $transaction: async (operation) => operation(updateTx) },
		actorUserId: "admin-1",
		id: "period-1",
		endsAt: new Date("2027-09-01T00:00:00+03:00"),
	}), { statusCode: 422 });
});

test("admin saves one semester at a time for the current academic year", async () => {
	const periods = new Map();
	let savedData;
	let auditEvent;
	const tx = {
		course: { findMany: async ({ where }) => where.id.in.map((id) => ({ id })) },
		academicPeriod: {
			findUnique: async ({ where }) => periods.get(where.scheduleKey) ?? null,
			upsert: async ({ where, create, update }) => {
				const current = periods.get(where.scheduleKey);
				savedData = current ? update : create;
				const result = { id: current?.id ?? "period-1", ...savedData };
				periods.set(where.scheduleKey, result);
				return result;
			},
		},
		auditLog: { create: async ({ data }) => { auditEvent = data; return data; } },
	};
	const db = { $transaction: async (operation) => operation(tx) };
	const result = await saveAcademicYearSchedule({
		db,
		actorUserId: "admin-1",
		academicYear: "2026/27",
		semester: 1,
		schedule: {
			startsAt: new Date("2026-08-31T21:00:00.000Z"),
			endsAt: new Date("2026-12-20T20:59:59.999Z"),
		},
		now: new Date("2026-11-18T09:00:00.000Z"),
	});
	assert.equal(result.semester, 1);
	assert.equal(periods.has("2026/27:S2"), false);
	assert.equal(savedData.academicYear, "2026/27");
	assert.equal(auditEvent.metadata.semester, 1);
});

test("admin cannot set up semester 2 before semester 1 ends", async () => {
	let upserted = false;
	const tx = {
		academicPeriod: {
			findUnique: async ({ where }) => where.scheduleKey === "2026/27:S1"
				? { id: "semester-1", endsAt: new Date("2026-12-20T20:59:59.999Z") }
				: null,
			upsert: async () => { upserted = true; },
		},
	};
	await assert.rejects(saveAcademicYearSchedule({
		db: { $transaction: async (operation) => operation(tx) },
		actorUserId: "admin-1",
		academicYear: "2026/27",
		semester: 2,
		schedule: { startsAt: new Date("2027-01-04T21:00:00.000Z"), endsAt: new Date("2027-04-30T20:59:59.999Z") },
		now: new Date("2026-12-20T20:59:59.999Z"),
	}), { statusCode: 409 });
	assert.equal(upserted, false);
});

test("admin can set up semester 2 after semester 1 has ended", async () => {
	const periods = new Map([["2026/27:S1", {
		id: "semester-1",
		endsAt: new Date("2026-12-20T20:59:59.999Z"),
	}]]);
	let saved;
	const tx = {
		academicPeriod: {
			findUnique: async ({ where }) => periods.get(where.scheduleKey) ?? null,
			upsert: async ({ create }) => { saved = create; return { id: "semester-2", ...create }; },
		},
		auditLog: { create: async () => ({}) },
	};
	const result = await saveAcademicYearSchedule({
		db: { $transaction: async (operation) => operation(tx) },
		actorUserId: "admin-1",
		academicYear: "2026/27",
		semester: 2,
		schedule: { startsAt: new Date("2027-01-04T21:00:00.000Z"), endsAt: new Date("2027-04-30T20:59:59.999Z") },
		now: new Date("2026-12-20T21:00:00.000Z"),
	});
	assert.equal(result.semester, 2);
	assert.equal(saved.scheduleKey, "2026/27:S2");
});

test("admin can set up course-scoped semester 3 after semester 2 has ended", async () => {
	const periods = new Map([["2026/27:S2", {
		id: "semester-2",
		endsAt: new Date("2027-04-30T20:59:59.999Z"),
	}]]);
	let created;
	const tx = {
		course: { findMany: async ({ where }) => where.id.in.map((id) => ({ id })) },
		academicPeriod: {
			findUnique: async ({ where }) => periods.get(where.scheduleKey) ?? null,
			upsert: async ({ create }) => { created = create; return { id: "semester-3", ...create }; },
		},
		auditLog: { create: async () => ({}) },
	};
	const result = await saveAcademicYearSchedule({
		db: { $transaction: async (operation) => operation(tx) },
		actorUserId: "admin-1",
		academicYear: "2026/27",
		semester: 3,
		schedule: { startsAt: new Date("2027-04-30T21:00:00.000Z"), endsAt: new Date("2027-08-31T20:59:59.999Z") },
		courseIds: ["course-1"],
		now: new Date("2027-04-30T21:00:00.000Z"),
	});
	assert.equal(result.semester, 3);
	assert.deepEqual(created.eligibleCourses, { connect: [{ id: "course-1" }] });
});

test("admin cannot schedule a past academic year", async () => {
	await assert.rejects(saveAcademicYearSchedule({
		db: {},
		actorUserId: "admin-1",
		academicYear: "2025/26",
		semester: 1,
		schedule: { startsAt: new Date("2025-08-31T21:00:00.000Z"), endsAt: new Date("2025-12-20T20:59:59.999Z") },
		now: new Date("2026-11-18T09:00:00.000Z"),
	}), { statusCode: 409 });
});

test("administrator removal deactivates a lecturer assignment and keeps its history", async () => {
	let deactivation;
	let audit;
	const tx = {
		courseUnitLecturer: {
			findUnique: async () => ({ id: "mapping-1", isActive: true }),
			updateMany: async (query) => { deactivation = query; return { count: 1 }; },
		},
		auditLog: { create: async ({ data }) => { audit = data; return data; } },
	};
	const result = await deleteMapping({
		db: { $transaction: async (operation) => operation(tx) },
		actorUserId: "admin-1",
		id: "mapping-1",
	});
	assert.equal(deactivation.where.id, "mapping-1");
	assert.deepEqual(deactivation.data, { isActive: false, endedAt: result.endedAt });
	assert.equal(audit.action, "ADMIN_LECTURER_MAPPING_DEACTIVATED");
	assert.equal(result.isActive, false);
});