import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../../src/modules/admin/csv.js";
import { auditExportQuery, reportExportQuery } from "../../src/modules/admin/operations.validation.js";

test("CSV output escapes commas, quotes, and newlines", () => {
	const expected = "name,note\r\nAda,\"He said, \"\"hello\"\"\nagain\"\r\n";
	assert.equal(toCsv(["name", "note"], [["Ada", "He said, \"hello\"\nagain"]]), expected);
});

test("export validation applies the bounded row limit", () => {
	assert.equal(reportExportQuery.parse({}).maxRows, 1000);
	assert.equal(auditExportQuery.parse({ maxRows: "5000" }).maxRows, 5000);
	assert.equal(reportExportQuery.safeParse({ maxRows: "5001" }).success, false);
});