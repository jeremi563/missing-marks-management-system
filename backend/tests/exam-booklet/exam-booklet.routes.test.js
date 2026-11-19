import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const [{ default: studentRoutes }, { default: lecturerRoutes }, { codRoutes }] = await Promise.all([
	import("../../src/modules/student/student.routes.js"),
	import("../../src/modules/lecturer/lecturer.routes.js"),
	import("../../src/modules/cod/cod.routes.js"),
]);

test("student booklet retrieval and scanning routes require student auth and scan validation", () => {
	const retrieval = studentRoutes.stack.find((layer) => layer.route?.path === "/exam-booklets" && layer.route.methods.get);
	const scan = studentRoutes.stack.find((layer) => layer.route?.path === "/exam-booklets/scan" && layer.route.methods.post);
	assert.ok(retrieval);
	assert.equal(retrieval.route.stack.length, 3);
	assert.ok(scan);
	assert.equal(scan.route.stack.length, 5);
});

test("lecturer booklet allocation, preview, scan, manual lookup, history and replacement routes are registered", () => {
	const expected = [
		["/exam-booklets/sessions/:sessionId/allocate", "post", 5],
		["/exam-booklets/sessions/:sessionId/scan/preview", "post", 6],
		["/exam-booklets/sessions/:sessionId/scan", "post", 6],
		["/exam-booklets/sessions/:sessionId/manual-lookup", "post", 6],
		["/exam-booklets/sessions/:sessionId/scans", "get", 5],
		["/exam-booklets/:bookletId/replacements", "post", 6],
	];
	for (const [path, method, count] of expected) {
		const route = lecturerRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
		assert.ok(route, `${method.toUpperCase()} ${path}`);
		assert.equal(route.route.stack.length, count);
	}
});

test("COD replacement approval is mounted behind COD authentication and role authorization", () => {
	const route = codRoutes.stack.find((layer) => layer.route?.path === "/exam-booklets/:bookletId/replacements" && layer.route.methods.post);
	assert.ok(route);
	assert.equal(route.route.stack.length, 4);
});
