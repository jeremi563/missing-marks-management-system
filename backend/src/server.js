import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";

const server = app.listen(env.PORT, () => {
	console.info(`API listening on port ${env.PORT}`);
});

async function shutdown(signal) {
	console.info(`${signal} received; shutting down`);
	server.close(async () => {
		await prisma.$disconnect();
		process.exit(0);
	});
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
