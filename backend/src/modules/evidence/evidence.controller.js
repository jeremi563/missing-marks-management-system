import { getEvidenceDownload } from "../../shared/services/evidence.service.js";

function contentDispositionFilename(filename) {
	const asciiFilename = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_");
	return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function downloadEvidence(req, res, next) {
	try {
		const file = await getEvidenceDownload({
			db: req.app.locals.prisma,
			userId: req.user.id,
			roles: req.user.roles,
			evidenceId: req.params.evidenceId,
		});
		res.set({
			"Content-Type": file.mediaType,
			"Content-Length": String(file.buffer.length),
			"Content-Disposition": contentDispositionFilename(file.originalName),
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		});
		return res.status(200).send(file.buffer);
	} catch (error) {
		return next(error);
	}
}
