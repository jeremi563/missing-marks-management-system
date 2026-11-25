import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../shared/utils/app-error.js";
import { sendSuccess } from "../shared/utils/api-response.js";

const csrfCookieName = "csrf_token";
const csrfTokenLifetimeMs = 15 * 60 * 1000;
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function signToken(value) {
	return createHmac("sha256", env.JWT_SECRET).update(value).digest("base64url");
}

function valuesMatch(left, right) {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifySignedToken(signedToken) {
	if (typeof signedToken !== "string") return null;
	const [issuedAtValue, nonce, signature, ...rest] = signedToken.split(".");
	if (rest.length || !/^\d+$/.test(issuedAtValue ?? "") || !/^[\w-]{40,}$/.test(nonce ?? "")) return null;

	const issuedAt = Number(issuedAtValue);
	const now = Date.now();
	if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 60_000 || now - issuedAt > csrfTokenLifetimeMs) return null;

	const value = `${issuedAtValue}.${nonce}`;
	if (!valuesMatch(signature ?? "", signToken(value))) return null;
	return { value, expiresAt: issuedAt + csrfTokenLifetimeMs };
}

function issueSignedToken() {
	const issuedAt = Date.now();
	const value = `${issuedAt}.${randomBytes(32).toString("base64url")}`;
	return { value, signedValue: `${value}.${signToken(value)}`, expiresAt: issuedAt + csrfTokenLifetimeMs };
}

function setCsrfCookie(res, signedValue, expiresAt) {
	res.cookie(csrfCookieName, signedValue, {
		httpOnly: false,
		secure: env.NODE_ENV === "production",
		sameSite: env.COOKIE_SAME_SITE,
		path: "/api/v1",
		maxAge: Math.max(0, expiresAt - Date.now()),
	});
}

export function issueCsrfToken(req, res) {
	const existingToken = verifySignedToken(req.cookies?.[csrfCookieName]);
	const token = existingToken ?? issueSignedToken();
	setCsrfCookie(res, existingToken ? req.cookies[csrfCookieName] : token.signedValue, token.expiresAt);
	return sendSuccess(res, "CSRF token issued", {
		token: token.value,
		expiresAt: new Date(token.expiresAt).toISOString(),
	});
}

export function csrfProtection(req, res, next) {
	if (!unsafeMethods.has(req.method)) return next();

	const bearerToken = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
	const hasCookieAuthentication = Boolean(req.cookies?.access_token);
	if (!hasCookieAuthentication && bearerToken) return next();
	if (!hasCookieAuthentication && !req.get("origin")) return next();

	const cookieToken = verifySignedToken(req.cookies?.[csrfCookieName]);
	const requestToken = req.get("x-csrf-token");
	if (!cookieToken || !requestToken || !valuesMatch(requestToken, cookieToken.value)) {
		return next(new AppError(403, "Invalid or missing CSRF token"));
	}
	return next();
}
