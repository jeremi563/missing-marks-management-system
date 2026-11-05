import { AppError } from "./app-error.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;
const mimeByExtension = new Map([
	["pdf", "application/pdf"],
	["jpg", "image/jpeg"],
	["jpeg", "image/jpeg"],
	["png", "image/png"],
	["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

/** Provider-neutral validation for trusted server-side upload metadata. This does not store or accept file bytes. */
export function validateEvidenceMetadata(files, { existingCount = 0 } = {}) {
	if (!Array.isArray(files)) throw new AppError(400, "Evidence files must be provided as a list");
	if (!Number.isInteger(existingCount) || existingCount < 0 || existingCount + files.length > MAX_FILES) {
		throw new AppError(400, `No more than ${MAX_FILES} evidence files are allowed per special case`);
	}
	return files.map((file) => {
		if (!file || typeof file.originalName !== "string" || !file.originalName.trim()) throw new AppError(400, "Each evidence file needs an original filename");
		const extension = file.originalName.trim().split(".").at(-1)?.toLowerCase();
		const expectedMime = mimeByExtension.get(extension);
		if (!expectedMime) throw new AppError(400, "Evidence files must be PDF, JPG, JPEG, PNG or DOCX");
		const normalizedMime = typeof file.mediaType === "string" ? file.mediaType.split(";")[0].trim().toLowerCase() : "";
		if (normalizedMime !== expectedMime) throw new AppError(400, "Evidence file MIME type does not match its extension");
		if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 0 || file.sizeBytes > MAX_FILE_BYTES) throw new AppError(400, "Each evidence file must be no larger than 5 MB");
		return { originalName: file.originalName.trim(), mediaType: expectedMime, sizeBytes: file.sizeBytes };
	});
}

export const EVIDENCE_MAX_FILE_BYTES = MAX_FILE_BYTES;
export const EVIDENCE_MAX_FILES = MAX_FILES;
