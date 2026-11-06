import test from "node:test";
import assert from "node:assert/strict";
import { createEnrollment, createMapping } from "../../src/modules/admin/academic.service.js";

const ids = {
	student: "00000000-0000-4000-8000-000000000001",
	lecturer: "00000000-0000-4000-8000-000000000002",
	unit: "00000000-0000-4000-8000-000000000003",
	period: "00000000-0000-4000-8000-000000000004",
};

function transactionDb({ student, lecturer }) {
	const auditLog = { create: async () => ({}) };
	const tx = {
		studentProfile: { findFirst: async () => student ? { id: ids.student } : null },
		lecturerProfile: { findFirst: async () => lecturer ? { id: ids.lecturer } : null },
		courseUnit: { findUnique: async () => ({ id: ids.unit }) },
		academicPeriod: { findUnique: async () => ({ id: ids.period }) },
		unitEnrollment: { create: async ({ data }) => ({ id: "enrollment-id", ...data }) },
		courseUnitLecturer: { create: async ({ data }) => ({ id: "mapping-id", ...data }) },
		auditLog,
	};
	return { $transaction: async (callback) => callback(tx) };
}

test("enrolment creation rejects inactive or incorrectly assigned student profiles", async () => {
	await assert.rejects(
		createEnrollment({ db: transactionDb({ student: false }), actorUserId: "actor", studentProfileId: ids.student, courseUnitId: ids.unit, academicPeriodId: ids.period }),
		(error) => error.statusCode === 422,
	);
});

test("lecturer mapping creation rejects inactive or incorrectly assigned lecturer profiles", async () => {
	await assert.rejects(
		createMapping({ db: transactionDb({ lecturer: false }), actorUserId: "actor", lecturerProfileId: ids.lecturer, courseUnitId: ids.unit }),
		(error) => error.statusCode === 422,
	);
});