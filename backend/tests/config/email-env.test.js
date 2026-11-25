import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));

function loadEnvironment(overrides = {}, script = "await import('./src/config/env.js')") {
	const result = spawnSync(process.execPath, [
		"--input-type=module",
		"-e",
		script,
	], {
		cwd: backendDirectory,
		encoding: "utf8",
		env: Object.fromEntries(Object.entries({
			DOTENV_CONFIG_PATH: "/dev/null",
			NODE_ENV: "development",
			DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test?schema=public",
			JWT_SECRET: "email-env-test-secret-with-at-least-32-characters",
			SMTP_HOST: "",
			SMTP_PORT: "1025",
			SMTP_SECURE: "false",
			SMTP_USER: "",
			SMTP_PASSWORD: "",
			SMTP_FROM: "Missing Marks System <no-reply@missingmarks.local>",
			APP_BASE_URL: "http://localhost:5173",
			...overrides,
		}).filter(([, value]) => value !== undefined)),
	});
	return result;
}

test("validates the runtime database URL from DATABASE_POOL_URL when DATABASE_URL is absent", () => {
	const poolUrl = "postgresql://test:test@127.0.0.1:5432/pool_test?schema=public";
	const result = loadEnvironment(
		{ DATABASE_URL: undefined, DATABASE_POOL_URL: poolUrl },
		"const { env } = await import('./src/config/env.js'); console.log(env.DATABASE_URL === process.env.DATABASE_POOL_URL)",
	);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /true/);
	assert.equal(loadEnvironment({ DATABASE_URL: "", DATABASE_POOL_URL: poolUrl }).status, 0);
	const missingDatabaseUrl = loadEnvironment({ DATABASE_URL: undefined, DATABASE_POOL_URL: undefined });
	assert.notEqual(missingDatabaseUrl.status, 0);
	assert.match(missingDatabaseUrl.stderr, /DATABASE_URL:/);
	assert.notEqual(loadEnvironment({ DATABASE_URL: "not-a-url", DATABASE_POOL_URL: poolUrl }).status, 0);
	assert.notEqual(loadEnvironment({ DATABASE_URL: undefined, DATABASE_POOL_URL: "not-a-url" }).status, 0);
	assert.equal(loadEnvironment({ DIRECT_DATABASE_URL: "", DATABASE_POOL_URL: "" }).status, 0);
});

test("allows credential-free local Mailpit configuration and optional email configuration", () => {
	assert.equal(loadEnvironment().status, 0);
	assert.equal(loadEnvironment({
		SMTP_HOST: "",
		SMTP_FROM: "",
		APP_BASE_URL: "",
		SMTP_PORT: "",
	}).status, 0);
});

test("rejects partial SMTP authentication credentials", () => {
	assert.notEqual(loadEnvironment({ SMTP_USER: "local-user" }).status, 0);
	assert.notEqual(loadEnvironment({ SMTP_PASSWORD: "local-password" }).status, 0);
});

test("rejects invalid SMTP ports, boolean values, and sender headers", () => {
	assert.notEqual(loadEnvironment({ SMTP_PORT: "65536" }).status, 0);
	assert.notEqual(loadEnvironment({ SMTP_PORT: "not-a-port" }).status, 0);
	assert.notEqual(loadEnvironment({ SMTP_SECURE: "yes" }).status, 0);
	assert.notEqual(loadEnvironment({ SMTP_FROM: "bad\r\nBcc: victim@example.test" }).status, 0);
	assert.notEqual(loadEnvironment({ SMTP_FROM: "Name <not-an-email>" }).status, 0);
});

test("allows only safe HTTP(S) application URLs and requires HTTPS in production", () => {
	assert.equal(loadEnvironment({ APP_BASE_URL: "http://localhost:5173" }).status, 0);
	assert.equal(loadEnvironment({ NODE_ENV: "production", APP_BASE_URL: "https://app.example.test" }).status, 0);
	assert.notEqual(loadEnvironment({ APP_BASE_URL: "javascript:alert(1)" }).status, 0);
	assert.notEqual(loadEnvironment({ APP_BASE_URL: "ftp://app.example.test" }).status, 0);
	assert.notEqual(loadEnvironment({ APP_BASE_URL: "https://user:pass@app.example.test" }).status, 0);
	assert.notEqual(loadEnvironment({ NODE_ENV: "production", APP_BASE_URL: "http://app.example.test" }).status, 0);
});

test("the backend application loads without any SMTP configuration", () => {
	const result = spawnSync(process.execPath, [
		"--input-type=module",
		"-e",
		"const { app } = await import('./src/app.js'); const server = app.listen(0, '127.0.0.1', () => server.close())",
	], {
		cwd: backendDirectory,
		encoding: "utf8",
		env: {
			DOTENV_CONFIG_PATH: "/dev/null",
			NODE_ENV: "test",
			DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test?schema=public",
			JWT_SECRET: "email-env-test-secret-with-at-least-32-characters",
			SMTP_HOST: "",
			SMTP_PORT: "",
			SMTP_SECURE: "false",
			SMTP_USER: "",
			SMTP_PASSWORD: "",
			SMTP_FROM: "",
			APP_BASE_URL: "",
		},
	});
	assert.equal(result.status, 0, result.stderr);
});
