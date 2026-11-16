import test from "node:test";
import assert from "node:assert/strict";
import { validateEvidenceFiles, validateEvidenceMetadata, EVIDENCE_MAX_FILE_BYTES } from "../../src/shared/utils/evidence-validation.js";

test("accepts approved extension and matching MIME metadata up to 5 MB", () => {
	const files = validateEvidenceMetadata([{ originalName: "proof.PDF", mediaType: "application/pdf", sizeBytes: EVIDENCE_MAX_FILE_BYTES }]);
	assert.equal(files[0].mediaType, "application/pdf");
});

test("rejects unsupported extensions, MIME mismatch, oversized files and more than three attachments", () => {
	assert.throws(() => validateEvidenceMetadata([{ originalName: "proof.exe", mediaType: "application/octet-stream", sizeBytes: 1 }]), { statusCode: 400 });
	assert.throws(() => validateEvidenceMetadata([{ originalName: "proof.jpg", mediaType: "application/png", sizeBytes: 1 }]), { statusCode: 400 });
	assert.throws(() => validateEvidenceMetadata([{ originalName: "proof.pdf", mediaType: "application/pdf", sizeBytes: EVIDENCE_MAX_FILE_BYTES + 1 }]), { statusCode: 400 });
	assert.throws(() => validateEvidenceMetadata([1, 2, 3, 4].map((n) => ({ originalName: `${n}.pdf`, mediaType: "application/pdf", sizeBytes: 1 }))), { statusCode: 400 });
	assert.throws(() => validateEvidenceMetadata([{ originalName: "x.pdf", mediaType: "application/pdf", sizeBytes: 1 }], { existingCount: 3 }), { statusCode: 400 });
});

test("sanitizes path components and rejects files whose bytes do not match their declared type", () => {
	const file = { originalName: "../../evidence.pdf", mediaType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nbody\n%%EOF") };
	assert.equal(validateEvidenceFiles([file])[0].originalName, "evidence.pdf");
	assert.throws(() => validateEvidenceFiles([{ ...file, buffer: Buffer.from("MZ executable") }]), { statusCode: 400 });
	assert.throws(() => validateEvidenceFiles([{ ...file, originalName: "payload.exe" }]), { statusCode: 400 });
});

test("rejects oversized byte buffers and more than three actual uploads", () => {
	const valid = { originalName: "proof.pdf", mediaType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nbody\n%%EOF") };
	assert.throws(() => validateEvidenceFiles([{ ...valid, buffer: Buffer.alloc(EVIDENCE_MAX_FILE_BYTES + 1) }]), { statusCode: 400 });
	assert.throws(() => validateEvidenceFiles([valid, valid, valid, valid]), { statusCode: 400 });
});
