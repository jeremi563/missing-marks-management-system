import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError } from "../../src/shared/utils/app-error.js";
import { submitStudentAppeal } from "../../src/modules/student/student.service.js";
import { createSpecialCase } from "../../src/shared/services/feature5.service.js";
import { assertEvidenceAccess, getEvidenceDownload } from "../../src/shared/services/evidence.service.js";
import {
	createEvidenceStorage,
	saveEvidenceFiles,
	withEvidenceFileCleanup,
} from "../../src/shared/services/evidence-storage.service.js";

const pdf = Buffer.from("%PDF-1.7\nsample\n%%EOF");

async function temporaryStorage(t) {
	const directory = await mkdtemp(path.join(os.tmpdir(), "missing-marks-evidence-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return { directory, storage: createEvidenceStorage(directory) };
}

function reportEvidence(overrides = {}) {
	return {
		id: "evidence-1",
		reportId: "report-1",
		appealId: null,
		specialCaseId: null,
		originalName: "support.pdf",
		storageKey: "a".repeat(64),
		mediaType: "application/pdf",
		sizeBytes: pdf.length,
		report: {
			id: "report-1",
			studentProfileId: "student-1",
			assignedLecturerProfileId: "lecturer-profile-1",
			courseUnit: { departmentId: "department-1" },
		},
		appeal: null,
		specialCase: null,
		...overrides,
	};
}

test("stores privately named files and returns metadata without the storage key", async (t) => {
	const { directory, storage } = await temporaryStorage(t);
	let created;
	let audit;
	const result = await saveEvidenceFiles({
		db: {
			specialCaseEvidence: { create: async ({ data }) => {
				created = data;
				return { id: "evidence-1", reportId: data.reportId, appealId: null, specialCaseId: null, originalName: data.originalName, mediaType: data.mediaType, sizeBytes: data.sizeBytes, createdAt: new Date() };
			} },
			auditLog: { create: async ({ data }) => { audit = data; return data; } },
		},
		files: [{ originalName: "../../support.pdf", mediaType: "application/pdf", buffer: pdf }],
		reportId: "report-1",
		uploaderId: "student-user-1",
		storageKeys: [],
		storage,
	});

	assert.match(created.storageKey, /^[a-f0-9]{64}$/);
	assert.equal(created.originalName, "support.pdf");
	assert.deepEqual(await readdir(directory), [created.storageKey]);
	assert.deepEqual(await storage.read(created.storageKey), pdf);
	assert.equal("storageKey" in result[0], false);
	assert.equal(audit.action, "EVIDENCE_UPLOADED");
	assert.equal(audit.entityId, "evidence-1");
	assert.equal("storageKey" in audit.metadata, false);
});

test("removes written files when evidence persistence or transaction commit fails", async (t) => {
	const { directory, storage } = await temporaryStorage(t);
	const db = {
		$transaction: async (callback) => {
			await callback({
				specialCaseEvidence: { create: async () => ({ id: "evidence-1" }) },
				auditLog: { create: async () => ({}) },
			});
			throw new Error("transaction commit failed");
		},
	};
	await assert.rejects(
		withEvidenceFileCleanup((storageKeys) => db.$transaction((tx) => saveEvidenceFiles({
			db: tx,
			files: [{ originalName: "support.pdf", mediaType: "application/pdf", buffer: pdf }],
			reportId: "report-1",
			uploaderId: "student-user-1",
			storageKeys,
			storage,
		})), { storage }),
		/transaction commit failed/,
	);
	assert.deepEqual(await readdir(directory), []);

	await assert.rejects(
		withEvidenceFileCleanup((storageKeys) => saveEvidenceFiles({
			db: { specialCaseEvidence: { create: async () => { throw new Error("database write failed"); } } },
			files: [{ originalName: "support.pdf", mediaType: "application/pdf", buffer: pdf }],
			reportId: "report-1",
			uploaderId: "student-user-1",
			storageKeys,
			storage,
		}), { storage }),
		/database write failed/,
	);
	assert.deepEqual(await readdir(directory), []);
});

test("unauthorized students cannot attach evidence to another student's appeal or special case", async () => {
	let writes = 0;
	const storage = { write: async () => { writes += 1; return "b".repeat(64); }, remove: async () => {} };
	const appealDb = {
		studentProfile: { findUnique: async () => ({ id: "student-2" }) },
		$transaction: async (callback) => callback({
			missingMarkReport: { findFirst: async () => null },
		}),
	};
	await assert.rejects(submitStudentAppeal(
		appealDb,
		"student-user-2",
		"report-1",
		{ reason: "Please review." },
		[{ originalName: "support.pdf", mediaType: "application/pdf", buffer: pdf }],
		storage,
	), { statusCode: 404 });

	const specialCaseDb = {
		$transaction: async (callback) => callback({
			$queryRaw: async () => [{ id: "department-1" }],
			missingMarkReport: { findUnique: async () => ({
				id: "report-1",
				status: "PENDING",
				studentProfileId: "student-1",
				assignedLecturerProfileId: "lecturer-profile-1",
				courseUnit: { department: { id: "department-1", designatedCodUserId: "cod-1" } },
			}) },
			user: { findFirst: async () => ({ id: "cod-1" }) },
			studentProfile: { findUnique: async () => ({ id: "student-2" }) },
		}),
	};
	await assert.rejects(createSpecialCase({
		db: specialCaseDb,
		userId: "student-user-2",
		role: "student",
		reportId: "report-1",
		categoryId: "category-1",
		description: "Please review.",
		files: [{ originalName: "support.pdf", mediaType: "application/pdf", buffer: pdf }],
		storage,
	}), { statusCode: 404 });
	assert.equal(writes, 0);
});

test("allows only the owning student or assigned lecturer to download report evidence", async () => {
	const evidence = reportEvidence();
	const db = {
		studentProfile: { findUnique: async ({ where }) => where.userId === "student-user-1" ? ({ id: "student-1" }) : null },
		lecturerProfile: { findUnique: async () => ({ id: "lecturer-profile-2" }) },
	};
	await assertEvidenceAccess({ db, userId: "student-user-1", roles: ["student"], evidence });
	await assert.rejects(assertEvidenceAccess({ db, userId: "other-student", roles: ["student"], evidence }), { statusCode: 404 });
	await assert.rejects(assertEvidenceAccess({ db, userId: "lecturer-user-2", roles: ["lecturer"], evidence }), { statusCode: 404 });
});

test("restricts COD evidence access to designated departments and rejects inconsistent parent links", async () => {
	const evidence = reportEvidence();
	const db = {
		departmentMembership: { findMany: async () => [{ departmentId: "department-1" }] },
		user: { findFirst: async () => ({ id: "cod-user-1" }) },
		department: { findMany: async ({ where }) => where.designatedCodUserId === "cod-user-1" ? [{ id: "department-1" }] : [] },
	};
	await assertEvidenceAccess({ db, userId: "cod-user-1", roles: ["cod"], evidence });
	await assert.rejects(assertEvidenceAccess({ db, userId: "cod-user-2", roles: ["cod"], evidence }), { statusCode: 404 });
	await assert.rejects(assertEvidenceAccess({
		db,
		userId: "cod-user-1",
		roles: ["cod"],
		evidence: reportEvidence({ appealId: "appeal-1", appeal: { reportId: "other-report", studentProfileId: "student-1" } }),
	}), { statusCode: 404 });
	await assert.rejects(assertEvidenceAccess({ db, userId: "admin-1", roles: ["administrator"], evidence }), { statusCode: 404 });
});

test("downloads only existing evidence and records a metadata-only audit event", async () => {
	const evidence = reportEvidence();
	let audit;
	const db = {
		specialCaseEvidence: { findUnique: async () => evidence },
		studentProfile: { findUnique: async () => ({ id: "student-1" }) },
		auditLog: { create: async ({ data }) => { audit = data; return data; } },
	};
	const file = await getEvidenceDownload({
		db,
		userId: "student-user-1",
		roles: ["student"],
		evidenceId: evidence.id,
		storage: { read: async () => pdf },
	});
	assert.deepEqual(file.buffer, pdf);
	assert.equal(file.originalName, "support.pdf");
	assert.equal(audit.action, "EVIDENCE_DOWNLOADED");
	assert.deepEqual(audit.metadata, { reportId: "report-1", appealId: null, specialCaseId: null });
	assert.equal("storageKey" in file, false);
});

test("returns not-found for missing records and missing physical files without auditing", async () => {
	let audits = 0;
	const db = {
		specialCaseEvidence: { findUnique: async () => null },
		auditLog: { create: async () => { audits += 1; } },
	};
	await assert.rejects(getEvidenceDownload({ db, userId: "student-1", roles: ["student"], evidenceId: "missing" }), { statusCode: 404 });

	const evidence = reportEvidence();
	db.specialCaseEvidence.findUnique = async () => evidence;
	db.studentProfile = { findUnique: async () => ({ id: "student-1" }) };
	await assert.rejects(getEvidenceDownload({
		db,
		userId: "student-user-1",
		roles: ["student"],
		evidenceId: evidence.id,
		storage: { read: async () => { throw new AppError(404, "Evidence file not found"); } },
	}), { statusCode: 404 });
	assert.equal(audits, 0);
});
