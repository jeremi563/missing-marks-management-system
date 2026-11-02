import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { prisma } from "./config/database.js";
import lecturerRoutes from "./modules/lecturer/lecturer.routes.js";

export const app = express();
app.locals.prisma = prisma;

const apiRouter = express.Router();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.status(200).json({ success: true, data: { status: "ok" } }));
apiRouter.use("/auth", authRoutes);
apiRouter.use("/lecturer", lecturerRoutes);
app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
