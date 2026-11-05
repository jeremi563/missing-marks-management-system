import test from "node:test";
import assert from "node:assert/strict";
import { processOutboxBatch } from "../../src/shared/services/notification-outbox.service.js";

function makeOutboxDb({ resolved = false, resolveOnClaim = false, designatedCodOnClaim = null, notificationFailure = null, deadlineAt = null, databaseNow = null } = {}) {
	const now = new Date("2026-11-05T10:00:00.000Z");
	const calls = { claimSql: "", ownershipSql: "", timingSql: "", retrySql: "", delivered: 0, skipped: 0, rescheduledSql: "", retries: 0, inserted: 0, attempts: 0 };
	const event = { id: "outbox-1", dedupeKey: "COD_APPEAL_OVERDUE:appeal-1:cod-1", eventType: "COD_APPEAL_OVERDUE", entityType: "Appeal", entityId: "appeal-1", recipientUserId: "cod-1", reportId: "report-1", title: "Appeal review overdue", message: "Review required", availableAt: new Date(now.valueOf() - 1), attempts: 0 };
	let claimed = false;
	let delivered = false;
	let currentResolved = resolved;
	let currentDesignatedCod = "cod-1";
	let notificationFailurePending = notificationFailure;
	const tx = {
		$queryRaw: async (strings, ...values) => {
			const sql = strings.join(" ? ");
			if (sql.includes("WITH claim_clock")) {
				calls.claimSql = sql;
				if (claimed || delivered) return [];
				claimed = true;
				if (resolveOnClaim) currentResolved = true;
				if (designatedCodOnClaim) currentDesignatedCod = designatedCodOnClaim;
				calls.attempts += 1;
				return [{ id: event.id }];
			}
			if (sql.includes("FOR UPDATE") && sql.includes("claimed_by")) {
				calls.ownershipSql = sql;
				return claimed && !delivered ? [{ id: event.id }] : [];
			}
			if (sql.includes("SELECT clock_timestamp()")) {
				calls.timingSql = sql;
				return [{ now: databaseNow ?? now }];
			}
			if (sql.includes("Rescheduled because")) { calls.rescheduledSql = sql; claimed = false; return [{ id: event.id }]; }
			if (sql.includes("Skipped because")) { calls.skipped += 1; delivered = true; return [{ id: event.id }]; }
			if (sql.includes("SET delivered_at = clock_timestamp()")) { calls.delivered += 1; delivered = true; return [{ id: event.id }]; }
			if (sql.includes("available_at = clock_timestamp()")) { calls.retrySql = sql; calls.retries += 1; claimed = false; return [{ id: event.id }]; }
			throw new Error(`Unexpected SQL in outbox mock: ${sql}`);
		},
		notificationOutbox: {
			findMany: async () => [{ ...event, attempts: calls.attempts, claimedBy: "mock-worker" }],
		},
		user: { findFirst: async () => ({ id: "cod-1" }) },
		appeal: { findUnique: async () => ({ status: currentResolved ? "Approved" : "Submitted", reviewDeadlineAt: deadlineAt ?? new Date(now.valueOf() - 1000), report: { courseUnit: { department: { id: "dept-1", designatedCodUserId: currentDesignatedCod } } } }) },
		notification: {
			createMany: async () => { if (notificationFailurePending) { const error = notificationFailurePending; notificationFailurePending = null; throw error; } calls.inserted += 1; return { count: 1 }; },
			findUnique: async () => ({ id: "notification-1" }),
		},
	};
	const db = { $transaction: async (callback) => callback(tx), $queryRaw: tx.$queryRaw };
	return { calls, db, now };
}

test("claims use PostgreSQL time, SKIP LOCKED, a database timestamp, and recover expired leases", async () => {
	const fixture = makeOutboxDb();
	const result = await processOutboxBatch({ db: fixture.db });
	assert.match(fixture.calls.claimSql, /SKIP LOCKED/);
	assert.match(fixture.calls.claimSql, /clock_timestamp\(\)/);
	assert.match(fixture.calls.claimSql, /claimed_at = claim_clock\.now/);
	assert.match(fixture.calls.claimSql, /claimed_at < claim_clock\.now/);
	assert.equal(result.claimed, 1);
	assert.equal(result.delivered, 1);
	assert.equal(fixture.calls.inserted, 1);
});

test("resolved overdue items are skipped without creating notifications", async () => {
	const fixture = makeOutboxDb({ resolved: true });
	const result = await processOutboxBatch({ db: fixture.db });
	assert.equal(result.delivered, 0);
	assert.equal(fixture.calls.inserted, 0);
	assert.equal(fixture.calls.skipped, 1);
});

test("an appeal resolved after claim is rechecked and skipped before notification creation", async () => {
	const fixture = makeOutboxDb({ resolveOnClaim: true });
	const result = await processOutboxBatch({ db: fixture.db });
	assert.equal(result.delivered, 0);
	assert.equal(fixture.calls.inserted, 0);
	assert.equal(fixture.calls.skipped, 1);
});

test("an overdue event for a former COD is skipped after replacement", async () => {
	const fixture = makeOutboxDb({ designatedCodOnClaim: "cod-new" });
	const result = await processOutboxBatch({ db: fixture.db });
	assert.equal(result.delivered, 0);
	assert.equal(fixture.calls.inserted, 0);
	assert.equal(fixture.calls.skipped, 1);
});

test("transient delivery failure retries using PostgreSQL time and later delivers once", async () => {
	const fixture = makeOutboxDb({ notificationFailure: new Error("temporary notification failure") });
	await processOutboxBatch({ db: fixture.db });
	assert.equal(fixture.calls.retries, 1);
	assert.match(fixture.calls.retrySql, /available_at = clock_timestamp\(\)/);
	assert.match(fixture.calls.retrySql, /INTERVAL '1 millisecond'/);
	const retry = await processOutboxBatch({ db: fixture.db });
	assert.equal(retry.delivered, 1);
	assert.equal(fixture.calls.inserted, 1);
});

test("events at their exact deadline are released, not marked delivered", async () => {
	const fixture = makeOutboxDb({ deadlineAt: new Date("2026-11-05T10:00:00.000Z") });
	const result = await processOutboxBatch({ db: fixture.db });
	assert.equal(result.delivered, 0);
	assert.equal(fixture.calls.inserted, 0);
	assert.match(fixture.calls.rescheduledSql, /available_at = .*INTERVAL '1 millisecond'/);
});

test("eligibility uses PostgreSQL processing time rather than a stale JavaScript time", async () => {
	const fixture = makeOutboxDb({ databaseNow: new Date("2026-11-05T10:00:00.002Z"), deadlineAt: new Date("2026-11-05T10:00:00.001Z") });
	const result = await processOutboxBatch({ db: fixture.db, now: new Date("2026-11-05T09:59:59.000Z") });
	assert.equal(result.delivered, 1);
	assert.equal(fixture.calls.inserted, 1);
});

test("competing worker passes do not claim or deliver one event twice", async () => {
	const fixture = makeOutboxDb();
	const results = await Promise.all([processOutboxBatch({ db: fixture.db }), processOutboxBatch({ db: fixture.db })]);
	assert.equal(results.reduce((total, result) => total + result.claimed, 0), 1);
	assert.equal(fixture.calls.inserted, 1);
});
