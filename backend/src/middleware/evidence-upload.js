import multer from "multer";
import { AppError } from "../shared/utils/app-error.js";
import {
	EVIDENCE_MAX_FILE_BYTES,
	EVIDENCE_MAX_FILES,
	EVIDENCE_MIME_BY_EXTENSION,
	sanitizeEvidenceFilename,
	validateEvidenceFiles,
} from "../shared/utils/evidence-validation.js";

const multipartUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: EVIDENCE_MAX_FILE_BYTES,
		files: EVIDENCE_MAX_FILES,
		fields: 20,
		parts: 24,
		fieldNameSize: 100,
		fieldSize: 16 * 1024,
	},
	fileFilter(req, file, callback) {
		try {
			const safeName = sanitizeEvidenceFilename(file.originalname);
			const extension = safeName.split(".").at(-1);
			const expectedMime = EVIDENCE_MIME_BY_EXTENSION.get(extension);
			if (file.mimetype?.split(";")[0].trim().toLowerCase() !== expectedMime) {
				throw new AppError(400, "Evidence file MIME type does not match its extension");
			}
			callback(null, true);
		} catch (error) {
			callback(error);
		}
	},
});

function mapMultipartError(error) {
	if (!(error instanceof multer.MulterError)) return error;
	if (error.code === "LIMIT_FILE_SIZE") return new AppError(413, "Each evidence file must be no larger than 5 MB");
	if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
		return new AppError(400, "No more than three evidence files may be attached");
	}
	return new AppError(400, "Evidence upload request is invalid");
}

export function uploadEvidence(req, res, next) {
	multipartUpload.array("evidence", EVIDENCE_MAX_FILES)(req, res, (error) => {
		if (error) return next(mapMultipartError(error));
		try {
			req.evidenceFiles = validateEvidenceFiles((req.files ?? []).map((file) => ({
					originalName: file.originalname,
					mediaType: file.mimetype,
					buffer: file.buffer,
				})));
			return next();
		} catch (validationError) {
			return next(validationError);
		}
	});
}
