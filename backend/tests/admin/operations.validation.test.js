import test from "node:test";
import assert from "node:assert/strict";
import { auditLogQuery, reportSummaryQuery, settingUpdateBody } from "../../src/modules/admin/operations.validation.js";

const id = "00000000-0000-4000-8000-000000000001";

test("settings validation accepts JSON values and report filters", () => {
	assert.equal(settingUpdateBody.safeParse({ value: 50, description: "Operational setting" }).success, true);
	assert.equal(reportSummaryQuery.safeParse({ page: "2", limit: "20", departmentId: id, from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" }).success, true);
});

test("report and audit filters reject reversed date ranges", () => {
	assert.equal(reportSummaryQuery.safeParse({ from: "2026-12-31T00:00:00Z", to: "2026-01-01T00:00:00Z" }).success, false);
	assert.equal(auditLogQuery.safeParse({ from: "2026-12-31T00:00:00Z", to: "2026-01-01T00:00:00Z" }).success, false);
});

test("settings validation rejects unknown fields", () => {
	assert.equal(settingUpdateBody.safeParse({ value: 50, key: "unexpected" }).success, false);
});