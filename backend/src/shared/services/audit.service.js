import { prisma } from "../../config/database.js";

const sensitiveKeyPattern = /(password|token|secret|authorization|cookie)/i;

function sanitizeMetadata(value) {
	if (Array.isArray(value)) return value.map(sanitizeMetadata);
	if (value && typeof value === "object" && !(value instanceof Date)) {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !sensitiveKeyPattern.test(key))
				.map(([key, nestedValue]) => [key, sanitizeMetadata(nestedValue)]),
		);
	}
	return value;
}

export async function recordAuditEvent({ actorId, action, entityType, entityId, metadata }) {
	return prisma.auditLog.create({
		data: {
			actorId,
			action,
			entityType,
			entityId: entityId == null ? null : String(entityId),
			metadata: metadata == null ? undefined : sanitizeMetadata(metadata),
		},
	});
}
