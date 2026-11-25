import "dotenv/config";
import { z } from "zod";

const optionalValue = (schema) => z.preprocess((value) => value === "" ? undefined : value, schema.optional());

// Keep a database URL required while accepting the runtime pool URL as its fallback.
const databaseUrlSchema = z.preprocess(
	(value) => (value === "" ? undefined : value) ?? (process.env.DATABASE_POOL_URL || undefined),
	z.string().url(),
);

const emailAddressSchema = z.string().email();
const smtpFromSchema = z.string().trim().refine((value) => {
	if (emailAddressSchema.safeParse(value).success) return true;
	const match = /^([^<>\r\n]+) <([^<>\s@]+@[^<>\s@]+)>$/.exec(value);
	return Boolean(match && emailAddressSchema.safeParse(match[2]).success);
}, "Expected an email address or Display Name <email@domain>");

const appBaseUrlSchema = optionalValue(z.string().url().refine((value) => {
	try {
		const url = new URL(value);
		return ["http:", "https:"].includes(url.protocol)
			&& !url.username
			&& !url.password
			&& !url.search
			&& !url.hash;
	} catch {
		return false;
	}
}, "Expected an HTTP(S) URL without credentials, query parameters, or a fragment"));

const environmentSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
	DATABASE_URL: databaseUrlSchema,
	DIRECT_DATABASE_URL: optionalValue(z.string().url()),
	DATABASE_POOL_URL: optionalValue(z.string().url()),
	JWT_SECRET: z.string().min(32),
	APP_BASE_URL: appBaseUrlSchema,
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
	SMTP_HOST: optionalValue(z.string().trim().min(1).refine((value) => !/\s/.test(value), "SMTP_HOST cannot contain whitespace")),
	SMTP_PORT: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(1).max(65535).default(587)),
	SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
	SMTP_USER: optionalValue(z.string().min(1)),
	SMTP_PASSWORD: optionalValue(z.string().min(1)),
	SMTP_FROM: optionalValue(smtpFromSchema),
}).superRefine((config, context) => {
	if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
		context.addIssue({
			code: "custom",
			path: [config.SMTP_USER ? "SMTP_PASSWORD" : "SMTP_USER"],
			message: "SMTP_USER and SMTP_PASSWORD must be provided together",
		});
	}
	if (config.NODE_ENV === "production" && config.APP_BASE_URL) {
		if (new URL(config.APP_BASE_URL).protocol !== "https:") {
			context.addIssue({
				code: "custom",
				path: ["APP_BASE_URL"],
				message: "APP_BASE_URL must use HTTPS in production",
			});
		}
	}
});

const result = environmentSchema.safeParse(process.env);

if (!result.success) {
	const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
	throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = result.data;
