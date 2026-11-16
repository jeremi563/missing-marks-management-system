import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const [{ default: lecturerRoutes }, { codRoutes }, { default: studentRoutes }] = await Promise.all([
	import("../../src/modules/lecturer/lecturer.routes.js"),
	import("../../src/modules/cod/cod.routes.js"),
	import("../../src/modules/student/student.routes.js"),
]);

function routeFor(router, path, method) {
	return router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
}

test("lecturer mark routes are mounted with authentication and lecturer authorization", () => {
	for (const [path, method] of [
		["/marks/options", "get"],
		["/assessments/:assessmentId/marks", "get"],
		["/assessments/:assessmentId/marks", "post"],
		["/reports/:reportId/corrections", "get"],
	]) {
		const route = routeFor(lecturerRoutes, path, method);
		assert.ok(route, `${method.toUpperCase()} ${path} should exist`);
		assert.ok(route.route.stack.length >= 3);
	}
});

test("COD and student mark routes exist under role-protected routers", () => {
	assert.ok(routeFor(codRoutes, "/mark-corrections", "get"));
	assert.ok(routeFor(codRoutes, "/mark-corrections/:correctionId", "get"));
	assert.ok(routeFor(codRoutes, "/mark-corrections/:correctionId/decision", "post"));
	assert.ok(routeFor(studentRoutes, "/marks", "get"));
});
