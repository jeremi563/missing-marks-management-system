import { constants } from "node:fs";
import { chmod, mkdir, open, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { AppError } from "../utils/app-error.js";
import { recordAuditEvent } from "./audit.service.js";
import { validateEvidenceFiles } from "../utils/evidence-validation.js";
import { logger } from "../utils/logger.js";

const DEFAULT_EVIDENCE_DIRECTORY = fileURLToPath(new URL("../../../uploads/evidence/", import.meta.url));
const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}$/;

function resolveStoragePath(storageDirectory, storageKey) {
	if (typeof storageKey !== "string" || !STORAGE_KEY_PATTERN.test(storageKey)) {
		throw new AppError(404, "Evidence file not found");
	}
	const root = path.resolve(storageDirectory);
	const filePath = path.resolve(root, storageKey);
	if (path.dirname(filePath) !== root) throw new AppError(404, "Evidence file not found");
	return filePath;
}

export function createEvidenceStorage(storageDirectory = DEFAULT_EVIDENCE_DIRECTORY) {
	const root = path.resolve(storageDirectory);
	return {
		async write(buffer) {
			await mkdir(root, { recursive: true, mode: 0o700 });
			await chmod(root, 0o700);
			const storageKey = randomBytes(32).toString("hex");
			const filePath = resolveStoragePath(root, storageKey);
			let handle;
			let created = false;
			try {
				handle = await open(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
				created = true;
				await handle.writeFile(buffer);
				await handle.close();
				handle = null;
				return storageKey;
			} catch (error) {
				try {
					await handle?.close();
				} catch (closeError) {
					logger.error("Evidence storage handle cleanup failed", { errorCode: closeError.code });
				}
				if (created) {
					try {
						await unlink(filePath);
					} catch (cleanupError) {
						if (cleanupError.code !== "ENOENT") {
							logger.error("Evidence storage write cleanup failed", { errorCode: cleanupError.code });
						}
					}
				}
				throw error;
			}
		},
		async read(storageKey) {
			const filePath = resolveStoragePath(root, storageKey);
			let handle;
			try {
				handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
				const fileStats = await handle.stat();
				if (!fileStats.isFile() || fileStats.size > 5 * 1024 * 1024) {
					throw new AppError(404, "Evidence file not found");
				}
				return await handle.readFile();
			} catch (error) {
				if (error.code === "ENOENT" || error.code === "ELOOP") {
					throw new AppError(404, "Evidence file not found");
				}
				throw error;
			} finally {
				await handle?.close();
			}
		},
		async remove(storageKey) {
			const filePath = resolveStoragePath(root, storageKey);
			try {
				await unlink(filePath);
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
			}
		},
	};
}

export const evidenceStorage = createEvidenceStorage();

export async function saveEvidenceFiles({
	db,
	files,
	reportId,
	appealId = null,
	specialCaseId = null,
	uploaderId,
	storageKeys,
	storage = evidenceStorage,
}) {
	if (!files?.length) return [];
	if (appealId && specialCaseId) throw new AppError(400, "Evidence cannot belong to both an appeal and a special case");

	const validFiles = validateEvidenceFiles(files);
	const evidence = [];
	for (const file of validFiles) {
		const { buffer, ...metadata } = file;
		const storageKey = await storage.write(buffer);
		storageKeys.push(storageKey);
		const saved = await db.specialCaseEvidence.create({
			data: {
				reportId,
				appealId,
				specialCaseId,
				uploadedByUserId: uploaderId,
				originalName: metadata.originalName,
				storageKey,
				mediaType: metadata.mediaType,
				sizeBytes: metadata.sizeBytes,
			},
			select: {
				id: true,
				reportId: true,
				appealId: true,
				specialCaseId: true,
				originalName: true,
				mediaType: true,
				sizeBytes: true,
				createdAt: true,
			},
		});
		await recordAuditEvent({
			prismaClient: db,
			actorId: uploaderId,
			action: "EVIDENCE_UPLOADED",
			entityType: "SpecialCaseEvidence",
			entityId: saved.id,
			metadata: { reportId, appealId, specialCaseId, sizeBytes: metadata.sizeBytes, mediaType: metadata.mediaType },
		});
		evidence.push(saved);
	}
	return evidence;
}

export async function withEvidenceFileCleanup(operation, { storage = evidenceStorage } = {}) {
	const storageKeys = [];
	try {
		return await operation(storageKeys);
	} catch (error) {
		for (const storageKey of storageKeys) {
			try {
				await storage.remove(storageKey);
			} catch (cleanupError) {
				logger.error("Evidence upload cleanup failed", { errorCode: cleanupError.code });
			}
		}
		throw error;
	}
}
