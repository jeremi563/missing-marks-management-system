import test from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

test("Prisma PostgreSQL adapter rejects raw void results but executes advisory-lock commands", async () => {
	const pool = new pg.Pool({ max: 1 });
	pool.query = async (query) => {
		assert.match(typeof query === "string" ? query : query.text, /pg_advisory_xact_lock/);
		return {
			fields: [{ name: "pg_advisory_xact_lock", dataTypeID: 2278 }],
			rows: [[null]],
			rowCount: 1,
		};
	};
	const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

	try {
		await assert.rejects(
			prisma.$queryRaw`SELECT pg_advisory_xact_lock(1, 2)`,
			(error) => error.code === "P2010" && error.message.includes("type 'void'"),
		);
		assert.equal(await prisma.$executeRaw`SELECT pg_advisory_xact_lock(1, 2)`, 1);
	} finally {
		await prisma.$disconnect();
	}
});
