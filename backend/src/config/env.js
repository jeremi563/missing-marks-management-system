import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
	DATABASE_URL: z.string().url(),
	JWT_SECRET: z.string().min(32),
	APP_BASE_URL: z.string().url().optional(),
	SMTP_HOST: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
	SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
	SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
	SMTP_USER: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
	SMTP_PASSWORD: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
	SMTP_FROM: z.string().email().optional(),
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
	const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
	throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = result.data;
