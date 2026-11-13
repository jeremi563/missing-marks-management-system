import test from "node:test";
import assert from "node:assert/strict";
import {
	isAdminRegistrationNumber,
	isStaffRegistrationNumber,
	isStudentRegistrationNumber,
	parseStudentRegistrationNumber,
} from "../../src/shared/utils/registration-number.js";

test("validates and parses department, course, unique number, and admission year", () => {
	const year = String(new Date().getFullYear() % 100).padStart(2, "0");
	assert.equal(isStudentRegistrationNumber(`IN16/00111/${year}`), true);
	assert.deepEqual(parseStudentRegistrationNumber("in16/00111/24"), {
		departmentInitials: "IN",
		courseCode: "16",
		uniqueNumber: "00111",
		admissionYear: 24,
	});
	assert.equal(isStudentRegistrationNumber("IN/00111/26"), false);
	assert.equal(isStudentRegistrationNumber(`IN16/00111/${String(Number(year) + 1).padStart(2, "0")}`), false);
	assert.equal(isStudentRegistrationNumber("IN16/00111/12"), false);
	assert.equal(isStudentRegistrationNumber("IN16/0111/24"), false);
});

test("validates lecturer and COD staff number format", () => {
	assert.equal(isStaffRegistrationNumber("AB/0123/STAFF9"), true);
	assert.equal(isStaffRegistrationNumber("AB/012/STAFF9"), false);
});

test("validates administrator number format and rejects future years", () => {
	const year = new Date().getFullYear();
	assert.equal(isAdminRegistrationNumber(`admin/12/${year}`), true);
	assert.equal(isAdminRegistrationNumber(`admin/12/${year + 1}`), false);
	assert.equal(isAdminRegistrationNumber("AB/0123/STAFF9"), false);
});
