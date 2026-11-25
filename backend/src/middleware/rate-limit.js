import { createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { sendFailure } from "../shared/utils/api-response.js";

const retryMessage = "Too many requests. Please try again later.";
const jwtAlgorithms = ["HS256"];

function digest(value) {
	return createHmac("sha256", env.JWT_SECRET).update(value).digest("hex");
}

function clientIp(req) {
	return ipKeyGenerator(req.ip);
}

function bearerOrCookieToken(req) {
	return req.cookies?.access_token ?? req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
}

function verifiedSubject(req) {
	if (typeof req.user?.id === "string" && req.user.id.length > 0) return req.user.id;

	const token = bearerOrCookieToken(req);
	if (!token) return undefined;

	try {
		const claims = jwt.verify(token, env.JWT_SECRET, { algorithms: jwtAlgorithms });
		return typeof claims === "object" && claims !== null && typeof claims.sub === "string"
			? claims.sub
			: undefined;
	} catch {
		return undefined;
	}
}

export function authenticatedUserRateLimitKey(req, scope = "api-user") {
	const userId = verifiedSubject(req);
	return userId
		? `${scope}:user:${digest(userId)}`
		: `${scope}:ip:${digest(clientIp(req))}`;
}

export function accountIpRateLimitKey(req, scope) {
	const account = req.body?.identifier ?? req.body?.email ?? req.body?.token;
	const normalizedAccount = typeof account === "string" ? account.trim().slice(0, 320).toLowerCase() : "";
	const identity = normalizedAccount ? `${clientIp(req)}:${normalizedAccount}` : clientIp(req);
	return `${scope}:${digest(identity)}`;
}

export function createRateLimiter({ windowMs, limit, keyGenerator, skip, skipSuccessfulRequests = false, store }) {
	return rateLimit({
		windowMs,
		limit,
		keyGenerator,
		skip,
		skipSuccessfulRequests,
		store,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (req, res) => {
			const resetTime = req.rateLimit?.resetTime;
			const retryAfter = resetTime instanceof Date
				? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
				: Math.ceil(windowMs / 1000);
			res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
			return sendFailure(res, retryMessage, 429);
		},
	});
}

export const apiIpRateLimit = createRateLimiter({
	windowMs: env.API_RATE_LIMIT_WINDOW_MS,
	limit: env.API_RATE_LIMIT_IP_MAX,
	keyGenerator: (req) => `api-ip:${digest(clientIp(req))}`,
});

export const apiUserRateLimit = createRateLimiter({
	windowMs: env.API_RATE_LIMIT_WINDOW_MS,
	limit: env.API_RATE_LIMIT_USER_MAX,
	keyGenerator: (req) => authenticatedUserRateLimitKey(req),
	skip: (req) => !verifiedSubject(req),
});

export const authenticationIpRateLimit = createRateLimiter({
	windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
	limit: env.AUTH_RATE_LIMIT_IP_MAX,
	keyGenerator: (req) => `auth-ip:${digest(clientIp(req))}`,
});

export const loginRateLimit = createRateLimiter({
	windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
	limit: env.LOGIN_RATE_LIMIT_MAX,
	keyGenerator: (req) => accountIpRateLimitKey(req, "login"),
	skipSuccessfulRequests: true,
});

export const registrationRateLimit = createRateLimiter({
	windowMs: env.REGISTRATION_RATE_LIMIT_WINDOW_MS,
	limit: env.REGISTRATION_RATE_LIMIT_MAX,
	keyGenerator: (req) => `registration-ip:${digest(clientIp(req))}`,
});

export const recoveryRateLimit = createRateLimiter({
	windowMs: env.RECOVERY_RATE_LIMIT_WINDOW_MS,
	limit: env.RECOVERY_RATE_LIMIT_MAX,
	keyGenerator: (req) => accountIpRateLimitKey(req, "recovery"),
});

export const sensitiveOperationRateLimit = createRateLimiter({
	windowMs: env.SENSITIVE_RATE_LIMIT_WINDOW_MS,
	limit: env.SENSITIVE_RATE_LIMIT_MAX,
	keyGenerator: (req) => authenticatedUserRateLimitKey(req, "sensitive"),
});

export const resourceIntensiveRateLimit = createRateLimiter({
	windowMs: env.RESOURCE_RATE_LIMIT_WINDOW_MS,
	limit: env.RESOURCE_RATE_LIMIT_MAX,
	keyGenerator: (req) => authenticatedUserRateLimitKey(req, "resource"),
});
