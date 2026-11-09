import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../../src/middleware/authorize.js";

test("student accounts cannot combine student and staff or administrator access", () => {
	for (const roles of [["student", "lecturer"], ["student", "cod"], ["student", "administrator"]]) {
		let capturedError;
		authorize("lecturer", "cod", "administrator")({ user: { roles } }, {}, (error) => { capturedError = error; });
		assert.equal(capturedError.statusCode, 403);
	}
});

test("staff may hold both lecturer and COD roles", () => {
	let calledNext = false;
	authorize("cod")({ user: { roles: ["lecturer", "cod"] } }, {}, (error) => {
		assert.equal(error, undefined);
		calledNext = true;
	});
	assert.equal(calledNext, true);
});

test("administrator access remains single-role only", () => {
	let capturedError;
	authorize("administrator")({ user: { roles: ["administrator", "lecturer"] } }, {}, (error) => { capturedError = error; });
	assert.equal(capturedError.statusCode, 403);
});