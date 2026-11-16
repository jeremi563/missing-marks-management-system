import { AppError } from "./app-error.js";
import { inflateRawSync } from "node:zlib";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;
export const EVIDENCE_MIME_BY_EXTENSION = new Map([
	["pdf", "application/pdf"],
	["jpg", "image/jpeg"],
	["jpeg", "image/jpeg"],
	["png", "image/png"],
	["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);

export function sanitizeEvidenceFilename(filename) {
	if (typeof filename !== "string") throw new AppError(400, "Each evidence file needs an original filename");
	const basename = filename.normalize("NFKC").replaceAll("\\", "/").split("/").at(-1) ?? "";
	const cleaned = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim();
	const extension = cleaned.split(".").at(-1)?.toLowerCase();
	if (!extension || !EVIDENCE_MIME_BY_EXTENSION.has(extension)) {
		throw new AppError(400, "Evidence files must be PDF, JPG, JPEG, PNG or DOCX");
	}
	const stem = cleaned.slice(0, -(extension.length + 1)).replace(/[. ]+$/g, "");
	if (!stem) throw new AppError(400, "Each evidence file needs a valid filename");
	const maxStemLength = 180 - extension.length - 1;
	return `${stem.slice(0, maxStemLength)}.${extension}`;
}

export function validateEvidenceMetadata(files, { existingCount = 0 } = {}) {
	if (!Array.isArray(files)) throw new AppError(400, "Evidence files must be provided as a list");
	if (!Number.isInteger(existingCount) || existingCount < 0 || existingCount + files.length > MAX_FILES) {
		throw new AppError(400, `No more than ${MAX_FILES} evidence files may be attached`);
	}
	return files.map((file) => {
		if (!file) throw new AppError(400, "Each evidence file needs an original filename");
		const originalName = sanitizeEvidenceFilename(file.originalName);
		const extension = originalName.split(".").at(-1);
		const expectedMime = EVIDENCE_MIME_BY_EXTENSION.get(extension);
		const normalizedMime = typeof file.mediaType === "string" ? file.mediaType.split(";")[0].trim().toLowerCase() : "";
		if (normalizedMime !== expectedMime) throw new AppError(400, "Evidence file MIME type does not match its extension");
		if (!Number.isInteger(file.sizeBytes) || file.sizeBytes < 0 || file.sizeBytes > MAX_FILE_BYTES) throw new AppError(400, "Each evidence file must be no larger than 5 MB");
		return { originalName, mediaType: expectedMime, sizeBytes: file.sizeBytes };
	});
}

function findEndOfCentralDirectory(buffer) {
	const earliestOffset = Math.max(0, buffer.length - 65_557);
	for (let offset = buffer.length - 22; offset >= earliestOffset; offset -= 1) {
		if (buffer.readUInt32LE(offset) === 0x06054b50) {
			const commentLength = buffer.readUInt16LE(offset + 20);
			if (offset + 22 + commentLength === buffer.length) return offset;
		}
	}
	return -1;
}

function readDocxEntry(buffer, entry) {
	const offset = entry.localHeaderOffset;
	if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) return null;
	const localNameLength = buffer.readUInt16LE(offset + 26);
	const localExtraLength = buffer.readUInt16LE(offset + 28);
	const dataOffset = offset + 30 + localNameLength + localExtraLength;
	const endOffset = dataOffset + entry.compressedSize;
	if (endOffset > buffer.length) return null;
	const compressed = buffer.subarray(dataOffset, endOffset);
	if (entry.compressionMethod === 0) return compressed;
	if (entry.compressionMethod !== 8) return null;
	try {
		return requireInflateRaw(compressed);
	} catch {
		return null;
	}
}

function requireInflateRaw(buffer) {
	return inflateRawSync(buffer, { maxOutputLength: 5 * 1024 * 1024 });
}

function isDocx(buffer) {
	if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) return false;
	const directoryOffset = findEndOfCentralDirectory(buffer);
	if (directoryOffset < 0) return false;
	const diskNumber = buffer.readUInt16LE(directoryOffset + 4);
	const directoryDisk = buffer.readUInt16LE(directoryOffset + 6);
	const entries = buffer.readUInt16LE(directoryOffset + 10);
	const directorySize = buffer.readUInt32LE(directoryOffset + 12);
	const directoryStart = buffer.readUInt32LE(directoryOffset + 16);
	if (diskNumber !== 0 || directoryDisk !== 0 || entries === 0 || entries > 256) return false;
	if (directoryStart + directorySize > directoryOffset) return false;

	const documents = new Map();
	let cursor = directoryStart;
	for (let index = 0; index < entries; index += 1) {
		if (cursor + 46 > directoryOffset || buffer.readUInt32LE(cursor) !== 0x02014b50) return false;
		const flags = buffer.readUInt16LE(cursor + 8);
		const compressionMethod = buffer.readUInt16LE(cursor + 10);
		const compressedSize = buffer.readUInt32LE(cursor + 20);
		const uncompressedSize = buffer.readUInt32LE(cursor + 24);
		const nameLength = buffer.readUInt16LE(cursor + 28);
		const extraLength = buffer.readUInt16LE(cursor + 30);
		const commentLength = buffer.readUInt16LE(cursor + 32);
		const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
		const end = cursor + 46 + nameLength + extraLength + commentLength;
		if (end > directoryOffset || (flags & 1) !== 0 || uncompressedSize > 5 * 1024 * 1024) return false;
		const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
		if (name === "[Content_Types].xml" || name === "word/document.xml") {
			documents.set(name, { compressionMethod, compressedSize, localHeaderOffset });
		}
		cursor = end;
	}
	if (cursor !== directoryStart + directorySize) return false;
	const contentTypesEntry = documents.get("[Content_Types].xml");
	const documentEntry = documents.get("word/document.xml");
	if (!contentTypesEntry || !documentEntry) return false;
	const contentTypes = readDocxEntry(buffer, contentTypesEntry)?.toString("utf8") ?? "";
	const documentXml = readDocxEntry(buffer, documentEntry)?.toString("utf8") ?? "";
	return contentTypes.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml")
		&& /<(?:[A-Za-z0-9_]+:)?document(?:\s|>)/.test(documentXml);
}

export function validateEvidenceFileContent(file) {
	if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
		throw new AppError(400, "Evidence file is empty or invalid");
	}
	const [{ originalName, mediaType, sizeBytes }] = validateEvidenceMetadata([{
		originalName: file.originalName,
		mediaType: file.mediaType,
		sizeBytes: file.buffer.length,
	}]);
	const extension = originalName.split(".").at(-1);
	const buffer = file.buffer;
	let valid = false;
	if (extension === "pdf") {
		valid = buffer.subarray(0, 5).toString("ascii") === "%PDF-"
			&& buffer.subarray(Math.max(0, buffer.length - 1024)).toString("ascii").includes("%%EOF");
	} else if (extension === "jpg" || extension === "jpeg") {
		valid = buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
			&& buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
	} else if (extension === "png") {
		valid = buffer.length >= 24
			&& buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
			&& buffer.subarray(12, 16).toString("ascii") === "IHDR";
	} else if (extension === "docx") {
		valid = isDocx(buffer);
	}
	if (!valid) throw new AppError(400, "Evidence file contents do not match the allowed format");
	return { originalName, mediaType, sizeBytes };
}

export function validateEvidenceFiles(files) {
	if (!Array.isArray(files)) throw new AppError(400, "Evidence files must be provided as a list");
	if (files.length > MAX_FILES) throw new AppError(400, `No more than ${MAX_FILES} evidence files may be attached`);
	return files.map((file) => {
		const metadata = validateEvidenceFileContent(file);
		return { ...metadata, buffer: file.buffer };
	});
}

export const EVIDENCE_MAX_FILE_BYTES = MAX_FILE_BYTES;
export const EVIDENCE_MAX_FILES = MAX_FILES;
