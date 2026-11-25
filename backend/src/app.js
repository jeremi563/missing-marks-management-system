import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { codRoutes } from "./modules/cod/cod.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { prisma } from "./config/database.js";
import lecturerRoutes from "./modules/lecturer/lecturer.routes.js";
import studentRoutes from "./modules/student/student.routes.js";
import { requestLogger } from "./middleware/request-logger.js";
import { logger } from "./shared/utils/logger.js";
import { feature5Routes } from "./modules/feature5/feature5.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import { evidenceRoutes } from "./modules/evidence/evidence.routes.js";
import { apiIpRateLimit, apiUserRateLimit } from "./middleware/rate-limit.js";

export const app = express();
app.locals.prisma = prisma;

if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

const allowedOrigins = (env.CORS_ORIGINS ?? "")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (origin && allowedOrigins.length === 0) {
		return res.sendStatus(403);
	}
	if (origin && allowedOrigins.includes(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Vary", "Origin");
		res.setHeader("Access-Control-Allow-Credentials", "true");
		res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
		res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
	}
	if (origin && !allowedOrigins.includes(origin)) return res.sendStatus(403);
	if (req.method === "OPTIONS") return res.sendStatus(204);
	return next();
});

const apiRouter = express.Router();

app.disable("x-powered-by");
app.use(helmet());
app.use(requestLogger());
app.use("/api/v1", apiIpRateLimit);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api/v1", apiUserRateLimit);

app.get("/health", (req, res) => res.status(200).json({ success: true, data: { status: "ok" } }));
app.get("/health/ready", async (req, res) => {
	try {
		await app.locals.prisma.$queryRaw`SELECT 1`;
		return res.status(200).json({
			success: true,
			data: { status: "ready", checks: { database: "connected" } },
		});
	} catch (error) {
		logger.warn("Readiness check failed", { check: "database", errorCode: error.code });
		return res.status(503).json({
			success: false,
			data: { status: "not_ready", checks: { database: "unavailable" } },
		});
	}
});
apiRouter.use("/auth", authRoutes);
apiRouter.use("/student", studentRoutes);
apiRouter.use("/lecturer", lecturerRoutes);
apiRouter.use("/cod", codRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/evidence", evidenceRoutes);
apiRouter.use(feature5Routes);

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
