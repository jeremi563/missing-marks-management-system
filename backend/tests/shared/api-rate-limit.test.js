import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";
process.env.API_RATE_LIMIT_WINDOW_MS = "60000";
process.env.API_RATE_LIMIT_IP_MAX = "100";
process.env.API_RATE_LIMIT_USER_MAX = "2";
process.env.TRUST_PROXY = "0";

const { app } = await import("../../src/app.js");

test("API applies the configured per-user limit across routes and does not trust forwarded IP headers", async () => {
	const server = app.listen(0);
	const url = `http://127.0.0.1:${server.address().port}`;
	const tokenFor = (id) => jwt.sign({}, process.env.JWT_SECRET, { subject: id, expiresIn: "15m" });
	const request = (id, forwardedFor) => fetch(`${url}/api/v1/unknown`, {
		headers: {
			Authorization: `Bearer ${tokenFor(id)}`,
			"X-Forwarded-For": forwardedFor,
		},
	});

	try {
		assert.equal((await request("user-1", "198.51.100.1")).status, 404);
		assert.equal((await request("user-1", "203.0.113.1")).status, 404);
		const blocked = await request("user-1", "203.0.113.2");
		assert.equal(blocked.status, 429);
		assert.ok(blocked.headers.get("retry-after"));
		assert.equal((await blocked.json()).message, "Too many requests. Please try again later.");
		assert.equal((await request("user-2", "203.0.113.2")).status, 404);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});
