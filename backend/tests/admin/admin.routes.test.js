import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");

test("administrator user routes require authentication", async () => {
	const server = app.listen(0);
	try {
		const address = server.address();
		const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/users`);
		assert.equal(response.status, 401);
		assert.equal((await response.json()).success, false);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});

test("every administrator endpoint requires authentication before database access", async () => {
	const id = "00000000-0000-4000-8000-000000000001";
	const endpoints = [
		["GET", "/api/v1/admin/pending-staff-accounts"], ["PATCH", `/api/v1/admin/users/${id}/approval`], ["POST", "/api/v1/admin/student-roster/import"],
		["GET", "/api/v1/admin/users"], ["POST", "/api/v1/admin/users"], ["PATCH", `/api/v1/admin/users/${id}`], ["DELETE", `/api/v1/admin/users/${id}`],
		["GET", "/api/v1/admin/departments"], ["POST", "/api/v1/admin/departments"], ["PATCH", `/api/v1/admin/departments/${id}`],
		["GET", "/api/v1/admin/courses"], ["POST", "/api/v1/admin/courses"],
		["GET", `/api/v1/admin/departments/${id}/members`], ["POST", `/api/v1/admin/departments/${id}/members`], ["DELETE", `/api/v1/admin/departments/${id}/members/${id}`],
		["GET", "/api/v1/admin/course-units"], ["POST", "/api/v1/admin/course-units"], ["PATCH", `/api/v1/admin/course-units/${id}`],
		["GET", "/api/v1/admin/academic-periods"], ["POST", "/api/v1/admin/academic-periods"], ["PATCH", `/api/v1/admin/academic-periods/${id}`],
		["GET", "/api/v1/admin/enrolments"], ["DELETE", `/api/v1/admin/enrolments/${id}`],
		["GET", "/api/v1/admin/lecturer-mappings"], ["DELETE", `/api/v1/admin/lecturer-mappings/${id}`],
		["GET", "/api/v1/admin/classrooms"], ["POST", "/api/v1/admin/classrooms"], ["PATCH", `/api/v1/admin/classrooms/${id}`],
		["GET", "/api/v1/admin/assessments"], ["POST", "/api/v1/admin/assessments"], ["PATCH", `/api/v1/admin/assessments/${id}`],
		["GET", "/api/v1/admin/assessment-types"], ["POST", "/api/v1/admin/assessment-types"], ["PATCH", `/api/v1/admin/assessment-types/${id}`],
		["GET", "/api/v1/admin/settings"], ["PATCH", "/api/v1/admin/settings/max_page_size"], ["GET", "/api/v1/admin/dashboard"],
		["GET", "/api/v1/admin/reports"], ["GET", "/api/v1/admin/reports/export"],
		["POST", `/api/v1/admin/reports/${id}/reopen`], ["POST", `/api/v1/admin/reports/${id}/reassign`],
		["GET", "/api/v1/admin/audit-logs"], ["GET", "/api/v1/admin/audit-logs/export"],
		["PATCH", `/api/v1/admin/departments/${id}/designated-cod`], ["POST", "/api/v1/admin/public-holidays"],
		["PATCH", `/api/v1/admin/public-holidays/${id}`], ["DELETE", `/api/v1/admin/public-holidays/${id}`],
	];
	const server = app.listen(0);
	try {
		const address = server.address();
		for (const [method, path] of endpoints) {
			const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method });
			assert.equal(response.status, 401, `${method} ${path} should require authentication`);
		}
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});