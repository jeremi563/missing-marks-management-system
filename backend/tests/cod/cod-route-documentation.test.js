import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
const { codRoutes } = await import("../../src/modules/cod/cod.routes.js");
const { feature5CodRoutes } = await import("../../src/modules/feature5/cod.routes.js");

const apiDocumentation = readFileSync(new URL("../../../docs/API.md", import.meta.url), "utf8");

test("Feature 7 attendance and Feature 5 COD routes appear in the API inventory", () => {
	const paths = [
		"GET /attendance-records", "GET /assessment-attendance", "GET /attendance-attempts",
		"GET /attendance-records/:id/history", "GET /attendance-discrepancies/:id/audit",
		"GET /attendance-summary", "GET /attendance-statistics", "GET /attendance-discrepancies",
		"GET /attendance-discrepancies/:id", "GET /attendance-discrepancies/:id/decisions", "POST /attendance-discrepancies/:id/decisions",
		"POST /attendance-discrepancies/:id/revalidate-legacy-authorization",
	];
	for (const methodPath of paths) {
		const [method, routePath] = methodPath.split(" ");
		assert.ok(codRoutes.stack.some((layer) => layer.route?.path === routePath && layer.route.methods[method.toLowerCase()]), `${methodPath} route missing`);
		assert.ok(apiDocumentation.includes(`| ${method} | \`/api/v1/cod${routePath}\` |`), `${methodPath} missing from docs`);
	}
	for (const layer of feature5CodRoutes.stack.filter((entry) => entry.route)) {
		const method = Object.keys(layer.route.methods)[0].toUpperCase();
		const path = `/api/v1/cod${layer.route.path}`;
		assert.ok(apiDocumentation.includes(`| ${method} | \`${path}\` |`), `${method} ${path} missing from docs`);
	}
	assert.ok(apiDocumentation.includes("/api/v1/admin/attendance-corrections"));
});

test("Student, Lecturer and Admin discrepancy/correction routes are registered and documented", async () => {
	const studentRoutes = (await import("../../src/modules/student/student.routes.js")).default;
	const lecturerRoutes = (await import("../../src/modules/lecturer/lecturer.routes.js")).default;
	const adminRoutes = (await import("../../src/modules/admin/admin.routes.js")).default;
	const expected = [
		[studentRoutes, "GET", "/attendance-discrepancies", "/api/v1/student/attendance-discrepancies"],
		[studentRoutes, "GET", "/attendance-discrepancies/:id", "/api/v1/student/attendance-discrepancies/:id"],
		[studentRoutes, "POST", "/attendance-discrepancies", "/api/v1/student/attendance-discrepancies"],
		[studentRoutes, "POST", "/attendance-discrepancies/:id/clarifications", "/api/v1/student/attendance-discrepancies/:id/clarifications"],
		[lecturerRoutes, "POST", "/attendance-discrepancies", "/api/v1/lecturer/attendance-discrepancies"],
		[lecturerRoutes, "GET", "/attendance-discrepancies", "/api/v1/lecturer/attendance-discrepancies"],
		[lecturerRoutes, "GET", "/attendance-discrepancies/:id", "/api/v1/lecturer/attendance-discrepancies/:id"],
		[lecturerRoutes, "POST", "/attendance-discrepancies/:id/review", "/api/v1/lecturer/attendance-discrepancies/:id/review"],
		[lecturerRoutes, "POST", "/attendance-discrepancies/:id/clarifications", "/api/v1/lecturer/attendance-discrepancies/:id/clarifications"],
		[adminRoutes, "POST", "/attendance-corrections", "/api/v1/admin/attendance-corrections"],
	];
	for (const [router, method, routePath, documentedPath] of expected) {
		const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method.toLowerCase()]);
		assert.ok(layer, `${method} ${routePath} route missing`);
		assert.ok(layer.route.stack.length >= 2, `${method} ${routePath} lacks validation/controller handlers`);
		assert.ok(apiDocumentation.includes(documentedPath), `${documentedPath} missing from docs`);
	}
});
