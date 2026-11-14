import test from "node:test";
import assert from "node:assert/strict";
import { createCourse, createCourseUnit, updateCourseUnit } from "../../src/modules/admin/academic.service.js";

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