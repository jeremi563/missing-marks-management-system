import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");

test("student profile route is mounted and requires authentication", async () => {
	const server = app.listen(0);
	try {
		const address = server.address();
		const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/student/profile`);
		assert.equal(response.status, 401);
		assert.equal((await response.json()).success, false);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});