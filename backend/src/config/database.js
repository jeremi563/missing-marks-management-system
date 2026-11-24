import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

const runtimeDatabaseUrl = env.DATABASE_POOL_URL ?? env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: runtimeDatabaseUrl });

export const prisma = new PrismaClient({ adapter });
