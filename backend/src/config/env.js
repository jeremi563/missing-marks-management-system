import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
	DATABASE_URL: z.string().url(),
	DIRECT_DATABASE_URL: z.string().url().optional(),
	DATABASE_POOL_URL: z.string().url().optional(),
	JWT_SECRET: z.string().min(32),
	APP_BASE_URL: z.string().url().optional(),
	CORS_ORIGINS: z.string().optional(),
	TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(0),
	API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(15 * 60 * 1000),
	API_RATE_LIMIT_IP_MAX: z.coerce.number().int().min(1).max(1_000_000).default(1200),
	API_RATE_LIMIT_USER_MAX: z.coerce.number().int().min(1).max(1_000_000).default(300),
	AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(15 * 60 * 1000),
	AUTH_RATE_LIMIT_IP_MAX: z.coerce.number().int().min(1).max(1_000_000).default(120),
	LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000_000).default(10),
	REGISTRATION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(60 * 60 * 1000),
	REGISTRATION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000_000).default(5),
	RECOVERY_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(15 * 60 * 1000),
	RECOVERY_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000_000).default(5),
	SENSITIVE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(15 * 60 * 1000),
	SENSITIVE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000_000).default(20),
	RESOURCE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(15 * 60 * 1000),
	RESOURCE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000_000).default(30),
	COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("strict"),
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
