import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import cookieParser from "cookie-parser";
import express from "express";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { csrfProtection, issueCsrfToken } = await import("../../src/middleware/csrf-protection.js");

function createServer() {
	const app = express();
	app.use(cookieParser());
	app.get("/csrf", issueCsrfToken);
	app.all("/mutate", csrfProtection, (req, res) => res.sendStatus(204));
	app.use((error, req, res, next) => res.status(error.statusCode ?? 500).json({ message: error.message }));
	return app.listen(0);
}

async function closeServer(server) {
	await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("issues a signed CSRF token and accepts it with the matching cookie", async () => {
	const server = createServer();
	try {
		const baseUrl = `http://127.0.0.1:${server.address().port}`;
		const tokenResponse = await fetch(`${baseUrl}/csrf`);
		const { data } = await tokenResponse.json();
		const cookie = tokenResponse.headers.get("set-cookie").split(";")[0];

		const response = await fetch(`${baseUrl}/mutate`, {
			method: "POST",
			headers: { origin: "https://app.example.test", cookie, "x-csrf-token": data.token },
		});
		assert.equal(response.status, 204);
		assert.match(cookie, /^csrf_token=/);
	} finally {
		await closeServer(server);
	}
});

test("rejects cookie-authenticated unsafe requests without a valid matching CSRF token", async () => {
	const server = createServer();
	try {
		const baseUrl = `http://127.0.0.1:${server.address().port}`;
		const tokenResponse = await fetch(`${baseUrl}/csrf`);
		const { data } = await tokenResponse.json();
		const csrfCookie = tokenResponse.headers.get("set-cookie").split(";")[0];

		for (const requestToken of [undefined, "forged-token"]) {
			const headers = { origin: "https://app.example.test", cookie: `${csrfCookie}; access_token=session-cookie` };
			if (requestToken) headers["x-csrf-token"] = requestToken;
			const response = await fetch(`${baseUrl}/mutate`, { method: "DELETE", headers });
			assert.equal(response.status, 403);
			assert.equal((await response.json()).message, "Invalid or missing CSRF token");
		}
	} finally {
		await closeServer(server);
	}
});

test("allows safe methods and bearer-only clients without a CSRF token", async () => {
	const server = createServer();
	try {
		const baseUrl = `http://127.0.0.1:${server.address().port}`;
		const safeResponse = await fetch(`${baseUrl}/mutate`);
		const bearerResponse = await fetch(`${baseUrl}/mutate`, {
			method: "POST",
			headers: { origin: "https://app.example.test", authorization: "Bearer client-token" },
		});
		assert.equal(safeResponse.status, 204);
		assert.equal(bearerResponse.status, 204);
	} finally {
		await closeServer(server);
	}
});

test("requires CSRF tokens for origin-bearing browser writes even before login", async () => {
	const server = createServer();
	try {
		const response = await fetch(`http://127.0.0.1:${server.address().port}/mutate`, {
			method: "POST",
			headers: { origin: "https://app.example.test" },
		});
		assert.equal(response.status, 403);
	} finally {
		await closeServer(server);
	}
});

test("rejects expired signed CSRF tokens", async () => {
	const server = createServer();
	try {
		const issuedAt = Date.now() - 15 * 60 * 1000 - 1;
		const value = `${issuedAt}.${randomBytes(32).toString("base64url")}`;
		const signature = createHmac("sha256", process.env.JWT_SECRET).update(value).digest("base64url");
		const response = await fetch(`http://127.0.0.1:${server.address().port}/mutate`, {
			method: "POST",
			headers: {
				origin: "https://app.example.test",
				cookie: `csrf_token=${value}.${signature}; access_token=session-cookie`,
				"x-csrf-token": value,
			},
		});
		assert.equal(response.status, 403);
	} finally {
		await closeServer(server);
	}
});
