import test from "node:test";
import assert from "node:assert/strict";
import { createLogger } from "../../src/shared/utils/logger.js";

test("writes structured JSON records with level and timestamp", () => {
	const records = [];
	const logger = createLogger({ sink: { info: (record) => records.push(JSON.parse(record)) } });
	logger.info("service started", { service: "api" });

	assert.equal(records.length, 1);
	assert.equal(records[0].level, "info");
	assert.equal(records[0].message, "service started");
	assert.equal(records[0].service, "api");
	assert.ok(Number.isNaN(Date.parse(records[0].timestamp)) === false);
});

test("filters records below the configured level", () => {
	const records = [];
	const logger = createLogger({ level: "warn", sink: { info: (record) => records.push(record), warn: (record) => records.push(record) } });
	logger.info("ignored");
	logger.warn("kept");

	assert.equal(records.length, 1);
	assert.equal(JSON.parse(records[0]).message, "kept");
});