import test from "node:test";
import assert from "node:assert/strict";
import { validateEvidenceMetadata, EVIDENCE_MAX_FILE_BYTES } from "../../src/shared/utils/evidence-validation.js";

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
