import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";
process.env.API_RATE_LIMIT_WINDOW_MS = "60000";
process.env.API_RATE_LIMIT_IP_MAX = "2";
process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
process.env.LOGIN_RATE_LIMIT_MAX = "2";

const {
	accountIpRateLimitKey,
	apiIpRateLimit,
	authenticatedUserRateLimitKey,
	createRateLimiter,
	loginRateLimit,
} = await import("../../src/middleware/rate-limit.js");

function startServer(app) {
	const server = app.listen(0);
	return {
		server,
		url: `http://127.0.0.1:${server.address().port}`,
		close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
	};
}

test("in-memory limiter enforces concurrent requests, returns rate headers, and expires counters", async () => {
	const app = express();
	app.use(createRateLimiter({
		windowMs: 1_000,
		limit: 3,
		keyGenerator: (req) => `test:${req.get("x-rate-key")}`,
	}));
	app.get("/", (_req, res) => res.status(200).json({ success: true }));
	const { url, close } = startServer(app);

	try {
		const responses = await Promise.all(
			Array.from({ length: 10 }, () => fetch(url, { headers: { "x-rate-key": "same-client" } })),
		);
		assert.equal(responses.filter((response) => response.status === 200).length, 3);
		const limited = responses.find((response) => response.status === 429);
		assert.ok(limited);
		assert.equal(limited.headers.get("ratelimit-limit"), "3");
		assert.equal(limited.headers.get("ratelimit-remaining"), "0");
		assert.ok(Number(limited.headers.get("retry-after")) > 0);
		assert.deepEqual(await limited.json(), {
			success: false,
			message: "Too many requests. Please try again later.",
		});

		await new Promise((resolve) => setTimeout(resolve, 1_100));
		assert.equal((await fetch(url, { headers: { "x-rate-key": "same-client" } })).status, 200);
	} finally {
		await close();
	}
});

test("authenticated identities share their bucket across IPs without exposing IDs", async () => {
	const jwt = await import("jsonwebtoken");
	const token = jwt.default.sign({}, process.env.JWT_SECRET, { subject: "user-1" });
	const makeRequest = (ip, bearer = token) => ({
		ip,
		user: undefined,
		cookies: {},
		get: (name) => name.toLowerCase() === "authorization" ? `Bearer ${bearer}` : undefined,
	});

	const first = authenticatedUserRateLimitKey(makeRequest("192.0.2.1"));
	const second = authenticatedUserRateLimitKey(makeRequest("198.51.100.2"));
	const other = authenticatedUserRateLimitKey(makeRequest("192.0.2.1", jwt.default.sign({}, process.env.JWT_SECRET, { subject: "user-2" })));
	assert.equal(first, second);
	assert.notEqual(first, other);
	assert.equal(first.includes("user-1"), false);
});

test("authentication account keys are scoped to the source IP", () => {
	const makeRequest = (ip, email) => ({ ip, body: { email } });
	const first = accountIpRateLimitKey(makeRequest("192.0.2.1", "Student@example.test"), "login");
	assert.equal(first, accountIpRateLimitKey(makeRequest("192.0.2.1", " student@EXAMPLE.test "), "login"));
	assert.notEqual(first, accountIpRateLimitKey(makeRequest("198.51.100.2", "student@example.test"), "login"));
	assert.equal(first.includes("student@example.test"), false);
	assert.notEqual(
		accountIpRateLimitKey({ ip: "192.0.2.1", body: { identifier: "student-1", email: "student@example.test" } }, "login"),
		first,
	);
});

test("API IP limits cannot be reset with client-supplied forwarding headers", async () => {
	const app = express();
	app.use(apiIpRateLimit);
	app.get("/", (_req, res) => res.status(200).end());
	const { url, close } = startServer(app);

	try {
		assert.equal((await fetch(url, { headers: { "x-forwarded-for": "198.51.100.1" } })).status, 200);
		assert.equal((await fetch(url, { headers: { "x-forwarded-for": "203.0.113.1" } })).status, 200);
		const blocked = await fetch(url, { headers: { "x-forwarded-for": "192.0.2.1" } });
		assert.equal(blocked.status, 429);
		assert.ok(blocked.headers.get("retry-after"));
	} finally {
		await close();
	}
});

test("login failures are rate limited per account and source, while successes do not lock accounts", async () => {
	const app = express();
	app.use(express.json());
	app.post("/", loginRateLimit, (req, res) => res.status(req.body.success ? 200 : 401).end());
	const { url, close } = startServer(app);
	const login = (email, success = false) => fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email, success }),
	});

	try {
		assert.equal((await login("target@example.test")).status, 401);
		assert.equal((await login("target@example.test")).status, 401);
		assert.equal((await login("target@example.test")).status, 429);
		assert.equal((await login("different@example.test")).status, 401);
		for (let attempt = 0; attempt < 3; attempt += 1) {
			assert.equal((await login("successful@example.test", true)).status, 200);
		}
	} finally {
		await close();
	}
});
