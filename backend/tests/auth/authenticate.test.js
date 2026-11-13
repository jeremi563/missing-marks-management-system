import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { authenticate } = await import("../../src/middleware/authenticate.js");

function makeRequest(sessionVersion, userSessionVersion) {
	const token = jwt.sign({ roles: ["student"], sessionVersion }, process.env.JWT_SECRET, { subject: "user-1", expiresIn: "15m" });
	const req = {
		get: (name) => name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined,
		app: {
			locals: {
				prisma: {
					user: {
						findUnique: async () => ({
							id: "user-1",
						email: "student@example.test",
							sessionVersion: userSessionVersion,
							isActive: true,
							approvalStatus: "APPROVED",
							roles: [{ role: { name: "student" } }],
						}),
					},
				},
			},
		},
		cookies: {},
	};
	return req;
}

test("rejects an access token issued before the user's session version changed", async () => {
	const req = makeRequest(2, 3);
	let nextError;
	await authenticate(req, {}, (error) => { nextError = error; });
	assert.equal(nextError?.statusCode, 401);
});

test("accepts access tokens issued at the current session version", async () => {
	const req = makeRequest(3, 3);
	let nextCalled = false;
	await authenticate(req, {}, (error) => { if (error) throw error; nextCalled = true; });
	assert.equal(nextCalled, true);
	assert.equal(req.user.sessionVersion, 3);
});

test("accepts pre-version tokens for accounts that have not changed their password", async () => {
	const req = makeRequest(undefined, 0);
	let nextCalled = false;
	await authenticate(req, {}, (error) => { if (error) throw error; nextCalled = true; });
	assert.equal(nextCalled, true);
});