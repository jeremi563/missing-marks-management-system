import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { uploadEvidence } from "../../src/middleware/evidence-upload.js";

const pdf = Buffer.from("%PDF-1.7\nsample\n%%EOF");

async function createUploadServer(t) {
	const app = express();
	app.post("/upload", uploadEvidence, (req, res) => res.status(200).json({
		files: req.evidenceFiles.map(({ originalName, mediaType, sizeBytes }) => ({ originalName, mediaType, sizeBytes })),
	}));
	app.use((error, req, res, next) => {
		if (res.headersSent) return next(error);
		return res.status(error.statusCode ?? 500).json({ message: error.message });
	});
	const server = await new Promise((resolve) => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
	return `http://127.0.0.1:${server.address().port}/upload`;
}

function formWithEvidence(files) {
	const form = new FormData();
	files.forEach(({ name, type, contents }) => form.append("evidence", new Blob([contents], { type }), name));
	return form;
}

test("accepts valid multipart PDF content and returns sanitized metadata", async (t) => {
	const url = await createUploadServer(t);
	const response = await fetch(url, { method: "POST", body: formWithEvidence([{ name: "../../support.pdf", type: "application/pdf", contents: pdf }]) });
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), {
		files: [{ originalName: "support.pdf", mediaType: "application/pdf", sizeBytes: pdf.length }],
	});
});

test("rejects unsupported, MIME-mismatched, and signature-mismatched files", async (t) => {
	const url = await createUploadServer(t);
	for (const file of [
		{ name: "payload.exe", type: "application/octet-stream", contents: Buffer.from("MZ") },
		{ name: "payload.pdf", type: "image/png", contents: pdf },
		{ name: "payload.pdf", type: "application/pdf", contents: Buffer.from("MZ executable") },
	]) {
		const response = await fetch(url, { method: "POST", body: formWithEvidence([file]) });
		assert.equal(response.status, 400);
	}
});

test("rejects more than three attachments and files exceeding 5 MB", async (t) => {
	const url = await createUploadServer(t);
	const tooMany = await fetch(url, {
		method: "POST",
		body: formWithEvidence([1, 2, 3, 4].map((n) => ({ name: `${n}.pdf`, type: "application/pdf", contents: pdf }))),
	});
	assert.equal(tooMany.status, 400);

	const tooLarge = await fetch(url, {
		method: "POST",
		body: formWithEvidence([{ name: "large.pdf", type: "application/pdf", contents: Buffer.alloc(5 * 1024 * 1024 + 1) }]),
	});
	assert.equal(tooLarge.status, 413);
});
