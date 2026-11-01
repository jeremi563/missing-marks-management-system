import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");

test("health endpoint responds without requiring a database connection", async () => {
	const server = app.listen(0);
	try {
		const address = server.address();
		const response = await fetch(`http://127.0.0.1:${address.port}/health`);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { success: true, data: { status: "ok" } });
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});

test("auth endpoints reject malformed payloads before database access", async () => {
	const server = app.listen(0);
	try {
		const address = server.address();
		const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/login`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "bad", password: "" }),
		});
		assert.equal(response.status, 400);
		assert.equal((await response.json()).success, false);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});

test("protected auth routes reject missing credentials without querying the database", async () => {
	const server = app.listen(0);
	try {
		const address = server.address();
		const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/me`);
		assert.equal(response.status, 401);
		assert.equal((await response.json()).success, false);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});