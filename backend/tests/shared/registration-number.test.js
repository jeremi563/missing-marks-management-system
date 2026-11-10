import test from "node:test";
import assert from "node:assert/strict";
import {
	isAdminRegistrationNumber,
	isStaffRegistrationNumber,
	isStudentRegistrationNumber,
} from "../../src/shared/utils/registration-number.js";

test("validates student numbers and rejects future academic years", () => {
	const year = new Date().getFullYear();
	assert.equal(isStudentRegistrationNumber(`AB/01243/${year}`), true);
	assert.equal(isStudentRegistrationNumber(`AB/01243/${year + 1}`), false);
	assert.equal(isStudentRegistrationNumber("AB/0123/2024"), false);
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
