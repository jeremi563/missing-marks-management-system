import test from "node:test";
import assert from "node:assert/strict";
import { evaluateConfiguredAttendanceEligibility } from "../../src/shared/services/eligibility.service.js";
import { getSystemSettingValue } from "../../src/shared/services/system-settings.service.js";
import { updateSetting } from "../../src/modules/admin/operations.service.js";

test("configured attendance eligibility uses the administrator threshold", async () => {
	const db = { systemSetting: { findUnique: async () => ({ value: 85 }) } };
	assert.deepEqual(await evaluateConfiguredAttendanceEligibility({ db, attendedSessions: 17, applicableSessions: 20 }), { percentage: 85, meetsRequirement: true });
});

test("system setting reads use the fallback when the setting is unavailable", async () => {
	assert.equal(await getSystemSettingValue({}, "missing", 14), 14);
	assert.equal(await getSystemSettingValue({ systemSetting: { findUnique: async () => null } }, "missing", 14), 14);
});

test("administrator policy settings accept approved values and reject invalid thresholds", async () => {
	const db = {
		$transaction: async (callback) => callback({
			systemSetting: { upsert: async ({ where, create }) => ({ key: where.key, value: create.value, description: null, updatedAt: new Date() }) },
			auditLog: { create: async () => ({}) },
		}),
	};
	const setting = await updateSetting({ db, actorUserId: "actor", key: "attendance_minimum_percentage", value: 80 });
	assert.equal(setting.value, 80);
	await assert.rejects(updateSetting({ db, actorUserId: "actor", key: "attendance_minimum_percentage", value: 101 }), (error) => error.statusCode === 422);
});