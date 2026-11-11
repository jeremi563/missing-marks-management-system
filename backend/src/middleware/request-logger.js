import { randomUUID } from "node:crypto";
import { logger as defaultLogger } from "../shared/utils/logger.js";

export function requestLogger(logger = defaultLogger) {
	return (req, res, next) => {
		const requestId = randomUUID();
		const startedAt = process.hrtime.bigint();
		req.requestId = requestId;
		res.setHeader("x-request-id", requestId);

		res.on("finish", () => {
			const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
			logger.info("HTTP request completed", {
				requestId,
				method: req.method,
				route: req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path,
				statusCode: res.statusCode,
				elapsedMs: Math.round(elapsedMs * 100) / 100,
			});
		});

		return next();
	};
}