import test from "node:test";
import assert from "node:assert/strict";
import { authenticate } from "../../src/middleware/authenticate.js";
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
const { codRoutes } = await import("../../src/modules/cod/cod.routes.js");
const { feature5CodRoutes } = await import("../../src/modules/feature5/cod.routes.js");
const { feature5Routes } = await import("../../src/modules/feature5/feature5.routes.js");

test("Feature 5 COD paths are composed once under the authenticated COD router", () => {
	const registered = feature5CodRoutes.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
	assert.equal(new Set(registered).size, registered.length);
	assert.equal(codRoutes.stack.filter((layer) => layer.handle === feature5CodRoutes).length, 1);
	assert.equal(typeof codRoutes.stack[0].handle, "function");
	assert.equal(typeof codRoutes.stack[1].handle, "function");
	assert.deepEqual(registered, [
		"GET /reports/overdue", "GET /appeals/overdue", "GET /special-cases/overdue", "GET /appeals",
		"GET /appeals/:appealId", "POST /appeals/:appealId/decision", "GET /special-cases",
		"GET /special-cases/:caseId", "POST /special-cases/:caseId/decision", "GET /special-case-categories",
		"POST /special-case-categories", "PATCH /special-case-categories/:id",
	]);
});

test("public and administrator Feature 5 routes remain separately registered", () => {
	const paths = feature5Routes.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
	assert.ok(paths.includes("GET /public-holidays"));
	assert.ok(paths.includes("PATCH /admin/departments/:departmentId/designated-cod"));
	assert.ok(paths.includes("POST /admin/public-holidays"));
	assert.ok(!paths.includes("GET /appeals"));
});

test("COD and unauthenticated requests cannot execute the Admin attendance correction endpoint", async () => {
	const adminRoutes = (await import("../../src/modules/admin/admin.routes.js")).default;
	const correctionRoute = adminRoutes.stack.find((layer) => layer.route?.path === "/attendance-corrections" && layer.route.methods.post);
	assert.ok(correctionRoute);
	assert.ok(correctionRoute.route.stack.length >= 2);
	assert.equal(codRoutes.stack.some((layer) => layer.route?.path === "/attendance-corrections"), false);
	let authenticationError;
	await codRoutes.stack[0].handle({ get: () => undefined, cookies: {} }, {}, (error) => { authenticationError = error; });
	assert.equal(authenticationError.statusCode, 401);
	let roleError;
	codRoutes.stack[1].handle({ user: { roles: ["student"] } }, {}, (error) => { roleError = error; });
	assert.equal(roleError.statusCode, 403);
	const authIndex = adminRoutes.stack.findIndex((layer) => layer.handle === authenticate);
	assert.ok(authIndex >= 0);
	const administratorGate = adminRoutes.stack[authIndex + 1].handle;
	let administratorError;
	administratorGate({ user: { roles: ["administrator"] } }, {}, (error) => { administratorError = error; });
	assert.equal(administratorError, undefined);
	let nonAdministratorError;
	administratorGate({ user: { roles: ["cod"] } }, {}, (error) => { nonAdministratorError = error; });
	assert.equal(nonAdministratorError.statusCode, 403);
});
