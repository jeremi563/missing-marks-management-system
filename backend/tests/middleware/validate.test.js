import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validate } from "../../src/middleware/validate.js";

test("replaces Express query getter with validated query values", () => {
	const req = {};
	Object.defineProperty(req, "query", {
		configurable: true,
		get: () => ({ page: "2", limit: "25" }),
	});

	let nextCalled = false;
	validate(z.object({
		page: z.coerce.number().int().min(1),
		limit: z.coerce.number().int().min(1),
	}).strict(), "query")(req, {}, (error) => {
		assert.equal(error, undefined);
		nextCalled = true;
	});

	assert.equal(nextCalled, true);
	assert.deepEqual(req.query, { page: 2, limit: 25 });
});
