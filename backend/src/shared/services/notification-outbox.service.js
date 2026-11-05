import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database.js";
import { createNotification } from "./notification.service.js";

const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
const CLAIM_LIMIT = 20;
const LEASE_MS = 5 * 60 * 1000;

async function isValidDesignatedCod(tx, departmentId, userId) {
	if (!departmentId || !userId) return false;
	const user = await tx.user.findFirst({ where: { id: userId, isActive: true, roles: { some: { role: { name: "cod" } } }, departmentMemberships: { some: { departmentId } } }, select: { id: true } });
	return Boolean(user);
}

export async function enqueueNotification(db, event) {
	return db.notificationOutbox.create({
		data: {
			dedupeKey: event.dedupeKey,
			eventType: event.eventType,
			entityType: event.entityType,
			entityId: event.entityId,
			recipientUserId: event.recipientUserId,
			reportId: event.reportId,
			title: event.title,
			message: event.message,
			availableAt: event.availableAt,
		},
	});
}

export async function enqueueNotificationOnce(db, event) {
	try {
		return await enqueueNotification(db, event);
	} catch (error) {
		if (error.code === "P2002") return null;
		throw error;
	}
}

async function claimBatch(db = prisma) {
	return db.$transaction(async (tx) => {
		const claimed = await tx.$queryRaw`
			WITH claim_clock AS MATERIALIZED (SELECT clock_timestamp() AS now),
			claimable AS (
				SELECT event.id
				FROM notification_outbox AS event, claim_clock
				WHERE event.delivered_at IS NULL
				  AND event.available_at <= claim_clock.now
				  AND (event.claimed_at IS NULL OR event.claimed_at < claim_clock.now - (${LEASE_MS} * INTERVAL '1 millisecond'))
				ORDER BY event.available_at, event.created_at
				FOR UPDATE OF event SKIP LOCKED
				LIMIT ${CLAIM_LIMIT}
			)
			UPDATE notification_outbox AS event
			SET claimed_at = claim_clock.now, claimed_by = ${workerId}, attempts = event.attempts + 1
			FROM claimable, claim_clock
			WHERE event.id = claimable.id
			RETURNING event.id
		`;
		if (!claimed.length) return [];
		return tx.notificationOutbox.findMany({ where: { id: { in: claimed.map(({ id }) => id) } } });
	});
}

async function eventStillOverdue(tx, event, now) {
	if (event.eventType === "LECTURER_REPORT_OVERDUE" || event.eventType === "COD_REPORT_OVERDUE") {
		const report = await tx.missingMarkReport.findUnique({
			where: { id: event.entityId },
			select: { status: true, assignedLecturerProfileId: true, courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } }, assignments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, newLecturerProfileId: true, deadlineAt: true, workStartedAt: true, newLecturer: { select: { userId: true } } } } },
		});
		const assignment = report?.assignments[0];
		if (!report || report.status.toUpperCase() !== "PENDING" || !assignment?.workStartedAt || !assignment.deadlineAt) return { eligible: false };
		if (event.eventType === "LECTURER_REPORT_OVERDUE" && (assignment.newLecturerProfileId !== report.assignedLecturerProfileId || assignment.newLecturer.userId !== event.recipientUserId)) return { eligible: false };
		if (event.eventType === "COD_REPORT_OVERDUE" && (report.courseUnit.department.designatedCodUserId !== event.recipientUserId || !await isValidDesignatedCod(tx, report.courseUnit.department.id, event.recipientUserId))) return { eligible: false };
		return assignment.deadlineAt < now ? { eligible: true } : { eligible: false, deadlineAt: assignment.deadlineAt };
	}
	if (event.eventType === "COD_APPEAL_OVERDUE") {
		const appeal = await tx.appeal.findUnique({
			where: { id: event.entityId },
			select: { status: true, reviewDeadlineAt: true, report: { select: { courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } } } },
		});
		if (!appeal || appeal.status.toUpperCase() !== "SUBMITTED" || !appeal.reviewDeadlineAt || appeal.report.courseUnit.department.designatedCodUserId !== event.recipientUserId || !await isValidDesignatedCod(tx, appeal.report.courseUnit.department.id, event.recipientUserId)) return { eligible: false };
		return appeal.reviewDeadlineAt < now ? { eligible: true } : { eligible: false, deadlineAt: appeal.reviewDeadlineAt };
	}
	if (event.eventType === "COD_SPECIAL_CASE_OVERDUE") {
		const item = await tx.specialCase.findUnique({
			where: { id: event.entityId },
			select: { status: true, reviewDeadlineAt: true, report: { select: { courseUnit: { select: { department: { select: { id: true, designatedCodUserId: true } } } } } } },
		});
		if (!item || item.status.toUpperCase() !== "SUBMITTED" || !item.reviewDeadlineAt || item.report.courseUnit.department.designatedCodUserId !== event.recipientUserId || !await isValidDesignatedCod(tx, item.report.courseUnit.department.id, event.recipientUserId)) return { eligible: false };
		return item.reviewDeadlineAt < now ? { eligible: true } : { eligible: false, deadlineAt: item.reviewDeadlineAt };
	}
	return false;
}

export async function processOutboxBatch({ db = prisma } = {}) {
	const events = await claimBatch(db);
	let delivered = 0;
	for (const event of events) {
		try {
			const wasDelivered = await db.$transaction(async (tx) => {
				const ownership = await tx.$queryRaw`
					SELECT id FROM notification_outbox
					WHERE id = ${event.id}::uuid AND delivered_at IS NULL AND claimed_by = ${workerId}
					FOR UPDATE
				`;
				if (!ownership.length) return false;
				if (event.eventType.endsWith("_OVERDUE")) {
					const [{ now: databaseNow }] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
					const eligibility = await eventStillOverdue(tx, event, databaseNow);
					if (!eligibility.eligible && eligibility.deadlineAt) {
						await tx.$queryRaw`
							UPDATE notification_outbox
							SET claimed_at = NULL, claimed_by = NULL,
							    available_at = ${eligibility.deadlineAt}::timestamptz + INTERVAL '1 millisecond',
							    last_error = 'Rescheduled because the item is not yet overdue.'
							WHERE id = ${event.id}::uuid AND claimed_by = ${workerId} AND delivered_at IS NULL
							RETURNING id
						`;
						return false;
					}
					if (!eligibility.eligible) {
						await tx.$queryRaw`
							UPDATE notification_outbox
							SET delivered_at = clock_timestamp(), last_error = 'Skipped because the item is no longer eligible.'
							WHERE id = ${event.id}::uuid AND claimed_by = ${workerId} AND delivered_at IS NULL
							RETURNING id
						`;
						return false;
					}
				}
				await createNotification({
					userId: event.recipientUserId,
					title: event.title,
					message: event.message,
					reportId: event.reportId,
					dedupeKey: event.dedupeKey,
					prismaClient: tx,
				});
				const delivered = await tx.$queryRaw`
					UPDATE notification_outbox
					SET delivered_at = clock_timestamp(), last_error = NULL
					WHERE id = ${event.id}::uuid AND claimed_by = ${workerId} AND delivered_at IS NULL
					RETURNING id
				`;
				return delivered.length === 1;
			});
			if (wasDelivered) delivered += 1;
		} catch (error) {
			const delayMs = Math.min(60 * 60 * 1000, 1000 * (2 ** Math.min(event.attempts, 10)));
			await db.$queryRaw`
				UPDATE notification_outbox
				SET claimed_at = NULL, claimed_by = NULL,
				    available_at = clock_timestamp() + (${delayMs} * INTERVAL '1 millisecond'),
				    last_error = ${String(error.message).slice(0, 1000)}
				WHERE id = ${event.id}::uuid AND delivered_at IS NULL AND claimed_by = ${workerId}
				RETURNING id
			`;
		}
	}
	return { claimed: events.length, delivered };
}

export async function runNotificationWorker({ db = prisma, pollIntervalMs = 5000, logger = console } = {}) {
	let stopping = false;
	const stop = () => { stopping = true; };
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	while (!stopping) {
		try {
			await processOutboxBatch({ db });
		} catch (error) {
			logger.error("Notification outbox poll failed", { message: error.message });
		}
		if (!stopping) await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
	process.off("SIGINT", stop);
	process.off("SIGTERM", stop);
}

export const OUTBOX_LEASE_MS = LEASE_MS;
