import { ZodError } from "zod";
import { sendFailure } from "../shared/utils/api-response.js";

export function notFoundHandler(req, res) {
	return sendFailure(res, `Route not found: ${req.method} ${req.path}`, 404);
}

export function errorHandler(error, req, res, next) {
	if (res.headersSent) return next(error);

	if (error instanceof ZodError) {
		return sendFailure(res, "Request validation failed", 400, error.issues);
	}

	if (error.code === "P2002") return sendFailure(res, "A record with these values already exists", 409);
	if (error.code === "P2025") return sendFailure(res, "Record not found", 404);

	const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
	if (statusCode >= 500) console.error({ name: error.name, code: error.code });
	return sendFailure(res, statusCode >= 500 ? "Internal server error" : error.message, statusCode, error.details);
}
