import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { codRoutes } from "./modules/cod/cod.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { prisma } from "./config/database.js";
import lecturerRoutes from "./modules/lecturer/lecturer.routes.js";
import studentRoutes from "./modules/student/student.routes.js";
import { requestLogger } from "./middleware/request-logger.js";
import { logger } from "./shared/utils/logger.js";
import { feature5Routes } from "./modules/feature5/feature5.routes.js";

export const app = express();
app.locals.prisma = prisma;

const apiRouter = express.Router();

app.disable("x-powered-by");
app.use(helmet());
app.use(requestLogger());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

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
apiRouter.use(feature5Routes);

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
