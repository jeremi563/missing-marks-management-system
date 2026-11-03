import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");

async function withServer(run) {
	const server = app.listen(0);
	try {
		const address = server.address();
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
}

test("readiness returns 200 when the database probe succeeds", async () => {
	const originalPrisma = app.locals.prisma;
	app.locals.prisma = { $queryRaw: async () => [{ result: 1 }] };
	try {
		await withServer(async (baseUrl) => {
			const response = await fetch(`${baseUrl}/health/ready`);
			assert.equal(response.status, 200);
			assert.deepEqual(await response.json(), {
				success: true,
				data: { status: "ready", checks: { database: "connected" } },
			});
			assert.ok(response.headers.get("x-request-id"));
		});
	} finally {
		app.locals.prisma = originalPrisma;
	}
});

test("readiness returns 503 without leaking database errors", async () => {
	const originalPrisma = app.locals.prisma;
	app.locals.prisma = { $queryRaw: async () => { throw new Error("private connection detail"); } };
	try {
		await withServer(async (baseUrl) => {
			const response = await fetch(`${baseUrl}/health/ready`);
			assert.equal(response.status, 503);
			const body = await response.json();
			assert.deepEqual(body, {
				success: false,
				data: { status: "not_ready", checks: { database: "unavailable" } },
			});
			assert.equal(JSON.stringify(body).includes("private connection detail"), false);
		});
	} finally {
		app.locals.prisma = originalPrisma;
	}
});