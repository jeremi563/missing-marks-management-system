import test from "node:test";
import assert from "node:assert/strict";
import { assignCodCourseUnitLecturer, listCodDepartmentCourseUnits, listCodDepartmentStudents, listCodDepartmentLecturers, listCodDepartments } from "../../src/modules/cod/cod.service.js";
import { codCourseUnitParamsSchema, codDirectoryQuerySchema, createCodCourseUnitLecturerBodySchema } from "../../src/modules/cod/cod.validation.js";

function authorizedDb() {
	return {
		departmentMembership: { findMany: async () => [{ departmentId: "department-1" }] },
		user: { findFirst: async () => ({ id: "cod-1" }) },
		department: {
			findMany: async ({ where }) => where.designatedCodUserId
				? [{ id: "department-1" }]
				: [{ id: "department-1", name: "Computing", code: "COMP" }],
			findFirst: async () => ({ id: "department-1", name: "Computing", code: "COMP", initials: "IN" }),
		},
	};
}

test("COD course-unit directory only queries designated department IDs", async () => {
	const db = authorizedDb();
	let observedWhere;
	db.courseUnit = {
		count: async ({ where }) => {
			observedWhere = where;
			return 1;
		},
		findMany: async ({ where, skip, take }) => {
			assert.deepEqual(where, { departmentId: { in: ["department-1"] }, courseId: { not: null } });
			assert.equal(skip, 20);
			assert.equal(take, 20);
			return [{ id: "unit-1", code: "COMP101", name: "Foundations", department: { id: "department-1", name: "Computing", code: "COMP" }, course: { id: "course-1", code: "16", name: "BSc Computing" } }];
		},
	};

	const result = await listCodDepartmentCourseUnits({ userId: "cod-1", departmentId: "department-1", page: 2, limit: 20, db });
	assert.deepEqual(observedWhere, { departmentId: { in: ["department-1"] }, courseId: { not: null } });
	assert.equal(result.items[0].code, "COMP101");
	assert.equal(result.items[0].course.code, "16");
	assert.deepEqual(result.pagination, { page: 2, limit: 20, total: 1, totalPages: 1 });
});

test("COD sidebar departments only include departments designated to the caller", async () => {
	const db = authorizedDb();
	const departments = await listCodDepartments({ userId: "cod-1", db });
	assert.deepEqual(departments, [{ id: "department-1", name: "Computing", code: "COMP" }]);
});

test("COD course-unit directory can filter to one authorized department", async () => {
	const db = authorizedDb();
	db.courseUnit = {
		count: async ({ where }) => {
			assert.deepEqual(where, { departmentId: { in: ["department-1"] }, courseId: { not: null } });
			return 0;
		},
		findMany: async ({ where }) => {
			assert.deepEqual(where, { departmentId: { in: ["department-1"] }, courseId: { not: null } });
			return [];
		},
	};
	const result = await listCodDepartmentCourseUnits({ userId: "cod-1", departmentId: "department-1", db });
	assert.equal(result.pagination.total, 0);
	const departmentId = "00000000-0000-4000-8000-000000000001";
	assert.equal(codDirectoryQuerySchema.safeParse({ departmentId }).success, true);
	assert.equal(codDirectoryQuerySchema.safeParse({}).success, false);
	await assert.rejects(
		listCodDepartmentCourseUnits({ userId: "cod-1", departmentId: "not-designated", db }),
		{ statusCode: 404 },
	);
});

test("COD student directory assigns profiles using designated department initials", async () => {
	const db = authorizedDb();
	let observedWhere;
	db.studentProfile = {
		count: async ({ where }) => {
			observedWhere = where;
			return 1;
		},
		findMany: async ({ where }) => {
			assert.deepEqual(where, observedWhere);
			return [{
				id: "student-1",
				studentNumber: "IN16/12345/26",
				officialEmail: "student@example.test",
				user: { displayName: "Student One", email: "login@example.test", isActive: true },
			}];
		},
	};

	const result = await listCodDepartmentStudents({ userId: "cod-1", departmentId: "department-1", db });
	assert.deepEqual(observedWhere, { studentNumber: { startsWith: "IN" } });
	assert.equal(result.items[0].department.code, "COMP");
	assert.equal(result.pagination.total, 1);
});

test("COD directory returns empty pages when the user has no designated departments", async () => {
	const db = {
		departmentMembership: { findMany: async () => [] },
	};

	assert.deepEqual(await listCodDepartmentCourseUnits({ userId: "cod-1", db }), {
		items: [],
		pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
	});
	assert.deepEqual(await listCodDepartmentStudents({ userId: "cod-1", departmentId: "department-1", db }), {
		items: [],
		pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
	});
});

test("COD student directory rejects a department not designated to the caller", async () => {
	await assert.rejects(
		listCodDepartmentStudents({ userId: "cod-1", departmentId: "other-department", db: authorizedDb() }),
		{ statusCode: 404 },
	);
});

test("COD lecturer directory lists only active approved lecturer memberships for its designated department", async () => {
	const db = authorizedDb();
	let observedWhere;
	db.departmentMembership.count = async ({ where }) => {
		observedWhere = where;
		return 1;
	};
	db.departmentMembership.findMany = async ({ where }) => {
		if (where.userId) return [{ departmentId: "department-1" }];
		assert.deepEqual(where, observedWhere);
		return [{
			user: {
				id: "lecturer-1",
				displayName: "Lecturer One",
				email: "lecturer@example.test",
				lecturerProfile: { staffNumber: "AB/1234/lecturer" },
				roles: [{ role: { name: "lecturer" } }],
			},
		}];
	};

	const result = await listCodDepartmentLecturers({ userId: "cod-1", departmentId: "department-1", db });
	assert.deepEqual(observedWhere, {
		departmentId: "department-1",
		user: {
			isActive: true,
			approvalStatus: "APPROVED",
			roles: { some: { role: { name: "lecturer" } } },
		},
	});
	assert.equal(result.items[0].lecturerProfile.staffNumber, "AB/1234/lecturer");
	assert.equal(result.pagination.total, 1);
});

test("COD lecturer directory rejects departments not designated to the caller", async () => {
	await assert.rejects(
		listCodDepartmentLecturers({ userId: "cod-1", departmentId: "other-department", db: authorizedDb() }),
		{ statusCode: 404 },
	);
});

test("COD can assign an active department lecturer to a department course unit and audit it", async () => {
	const db = authorizedDb();
	let createdMapping;
	let auditEvent;
	db.$transaction = async (operation) => operation({
		courseUnit: {
			findFirst: async ({ where }) => {
				assert.deepEqual(where, { id: "unit-1", departmentId: "department-1" });
				return { id: "unit-1", course: { id: "course-1" } };
			},
		},
		lecturerProfile: {
			findFirst: async ({ where }) => {
				assert.equal(where.id, "lecturer-profile-1");
				assert.equal(where.user.departmentMemberships.some.departmentId, "department-1");
				assert.equal(where.user.approvalStatus, "APPROVED");
				return { id: "lecturer-profile-1" };
			},
		},
		courseUnitLecturer: {
			findUnique: async ({ where }) => {
				assert.deepEqual(where, { courseUnitId_academicYear: { courseUnitId: "unit-1", academicYear: "2026/27" } });
				return null;
			},
			create: async ({ data }) => {
				createdMapping = data;
				return { id: "mapping-1", ...data };
			},
		},
		auditLog: {
			create: async ({ data }) => {
				auditEvent = data;
				return data;
			},
		},
	});

	const result = await assignCodCourseUnitLecturer({
		userId: "cod-1",
		courseUnitId: "unit-1",
		departmentId: "department-1",
		lecturerProfileId: "lecturer-profile-1",
		now: new Date("2026-11-12T12:00:00.000Z"),
		db,
	});
	assert.deepEqual(createdMapping, { courseUnitId: "unit-1", lecturerProfileId: "lecturer-profile-1", academicYear: "2026/27" });
	assert.equal(result.id, "mapping-1");
	assert.equal(auditEvent.action, "COD_COURSE_UNIT_LECTURER_ASSIGNED");
});

test("COD cannot assign an unclassified legacy course unit", async () => {
	const db = authorizedDb();
	db.$transaction = async (operation) => operation({
		courseUnit: { findFirst: async () => ({ id: "unit-1", course: null }) },
	});

	await assert.rejects(assignCodCourseUnitLecturer({
		userId: "cod-1",
		courseUnitId: "unit-1",
		departmentId: "department-1",
		lecturerProfileId: "lecturer-profile-1",
		db,
	}), { statusCode: 404 });
});

test("COD course-unit assignment rejects lecturers outside the department", async () => {
	const db = authorizedDb();
	db.$transaction = async (operation) => operation({
		courseUnit: { findFirst: async () => ({ id: "unit-1", course: { id: "course-1" } }) },
		lecturerProfile: { findFirst: async () => null },
	});

	await assert.rejects(
		assignCodCourseUnitLecturer({
			userId: "cod-1",
			courseUnitId: "unit-1",
			departmentId: "department-1",
			lecturerProfileId: "other-lecturer",
			db,
		}),
		{ statusCode: 422 },
	);
});

test("COD cannot assign a second lecturer to a course unit in the same academic year", async () => {
	const db = authorizedDb();
	let created = false;
	db.$transaction = async (operation) => operation({
		courseUnit: { findFirst: async () => ({ id: "unit-1", course: { id: "course-1" } }) },
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-profile-2" }) },
		courseUnitLecturer: {
			findUnique: async () => ({ id: "existing-assignment" }),
			create: async () => { created = true; },
		},
	});

	await assert.rejects(
		assignCodCourseUnitLecturer({
			userId: "cod-1",
			courseUnitId: "unit-1",
			departmentId: "department-1",
			lecturerProfileId: "lecturer-profile-2",
			now: new Date("2026-11-12T12:00:00.000Z"),
			db,
		}),
		(error) => error.statusCode === 409 && /2026\/27/.test(error.message),
	);
	assert.equal(created, false);
});

test("COD can assign a course unit again in a later academic year", async () => {
	const db = authorizedDb();
	let createdMapping;
	db.$transaction = async (operation) => operation({
		courseUnit: { findFirst: async () => ({ id: "unit-1", course: { id: "course-1" } }) },
		lecturerProfile: { findFirst: async () => ({ id: "lecturer-profile-2" }) },
		courseUnitLecturer: {
			findUnique: async ({ where }) => {
				assert.deepEqual(where, { courseUnitId_academicYear: { courseUnitId: "unit-1", academicYear: "2027/28" } });
				return null;
			},
			create: async ({ data }) => { createdMapping = data; return { id: "new-assignment", ...data }; },
		},
		auditLog: { create: async () => {} },
	});

	await assignCodCourseUnitLecturer({
		userId: "cod-1",
		courseUnitId: "unit-1",
		departmentId: "department-1",
		lecturerProfileId: "lecturer-profile-2",
		now: new Date("2027-09-12T12:00:00.000Z"),
		db,
	});
	assert.deepEqual(createdMapping, { courseUnitId: "unit-1", lecturerProfileId: "lecturer-profile-2", academicYear: "2027/28" });
});

test("COD assignment validation requires a department, course unit, and lecturer profile", () => {
	const departmentId = "00000000-0000-4000-8000-000000000001";
	const courseUnitId = "00000000-0000-4000-8000-000000000002";
	const lecturerProfileId = "00000000-0000-4000-8000-000000000003";
	assert.equal(codCourseUnitParamsSchema.safeParse({ courseUnitId }).success, true);
	assert.equal(createCodCourseUnitLecturerBodySchema.safeParse({ departmentId, lecturerProfileId }).success, true);
	assert.equal(createCodCourseUnitLecturerBodySchema.safeParse({ departmentId, lecturerProfileId, academicYear: "2026/27" }).success, false);
	assert.equal(createCodCourseUnitLecturerBodySchema.safeParse({ lecturerProfileId }).success, false);
});
