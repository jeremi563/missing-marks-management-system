import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { getMe } = await import("../../src/modules/auth/auth.controller.js");

test("authenticated user response includes their department names and codes", async () => {
	let responseBody;
	let statusCode;
	const memberships = [
		{ department: { id: "department-1", name: "Computing", code: "SIST" } },
	];
	const req = {
		user: { id: "lecturer-1", roles: ["lecturer"] },
		sessionExpiresAt: new Date("2026-11-12T12:00:00.000Z"),
		app: {
			locals: {
				prisma: {
					user: {
						findUnique: async (query) => {
							assert.deepEqual(query.select.departmentMemberships.select.department.select, {
								id: true,
								name: true,
								code: true,
							});
							return {
								avatarData: null,
								departmentMemberships: memberships,
								designatedDepartments: [{ id: "department-2", name: "Engineering", code: "SE" }],
							};
						},
					},
				},
			},
		},
	};
	const res = {
		status(code) {
			statusCode = code;
			return this;
		},
		json(body) {
			responseBody = body;
			return body;
		},
	};

	await getMe(req, res, (error) => { throw error; });
	assert.equal(statusCode, 200);
	assert.deepEqual(responseBody.data.user.departmentMemberships, memberships);
	assert.deepEqual(responseBody.data.user.designatedDepartments, [
		{ id: "department-2", name: "Engineering", code: "SE" },
	]);
});
