import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";
process.env.CORS_ORIGINS ??= "https://mmms.example.test";

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

test("browser writes require a signed CSRF token", async () => {
	const server = app.listen(0);
	try {
		const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
		const origin = "https://mmms.example.test";
		const csrfResponse = await fetch(`${baseUrl}/auth/csrf`, { headers: { origin } });
		const { data } = await csrfResponse.json();
		const cookie = csrfResponse.headers.get("set-cookie").split(";")[0];

		const missingToken = await fetch(`${baseUrl}/auth/login`, {
			method: "POST",
			headers: { origin, cookie, "content-type": "application/json" },
			body: JSON.stringify({ email: "bad", password: "" }),
		});
		assert.equal(missingToken.status, 403);

		const validToken = await fetch(`${baseUrl}/auth/login`, {
			method: "POST",
			headers: { origin, cookie, "x-csrf-token": data.token, "content-type": "application/json" },
			body: JSON.stringify({ email: "bad", password: "" }),
		});
		assert.equal(validToken.status, 400);
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

test("allows explicitly approved CORS origins", async () => {
	const server = app.listen(0);
	try {
		const address = server.address();
		const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
			headers: { origin: "https://mmms.example.test" },
		});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("access-control-allow-origin"), "https://mmms.example.test");
		assert.equal(response.headers.get("access-control-allow-credentials"), "true");
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});

test("rejects unapproved CORS origins and preflight requests", async () => {
	const server = app.listen(0);
	try {
		const address = server.address();
		const disallowed = await fetch(`http://127.0.0.1:${address.port}/health`, {
			headers: { origin: "https://other.example.test" },
		});
		assert.equal(disallowed.status, 403);
		assert.equal(disallowed.headers.get("access-control-allow-origin"), null);

		const preflight = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/login`, {
			method: "OPTIONS",
			headers: { origin: "https://other.example.test" },
		});
		assert.equal(preflight.status, 403);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});