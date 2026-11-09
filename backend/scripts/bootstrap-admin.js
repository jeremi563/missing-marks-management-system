import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";

const { BOOTSTRAP_ADMIN_NUMBER, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME } = process.env;

async function main() {
	if (!BOOTSTRAP_ADMIN_NUMBER || !BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD || BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
		throw new Error("Set BOOTSTRAP_ADMIN_NUMBER, BOOTSTRAP_ADMIN_EMAIL, and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.");
	}
	const email = BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
	const adminNumber = BOOTSTRAP_ADMIN_NUMBER.trim().toUpperCase();
	await prisma.$transaction(async (tx) => {
		const existingAdmin = await tx.user.findFirst({ where: { isActive: true, roles: { some: { role: { name: "administrator" } } } }, select: { id: true } });
		if (existingAdmin) throw new Error("An active administrator already exists; bootstrap is only for initial setup.");
		const role = await tx.role.upsert({ where: { name: "administrator" }, update: {}, create: { name: "administrator", description: "System administrator" } });
		const user = await tx.user.create({
			data: {
				email,
				displayName: BOOTSTRAP_ADMIN_NAME?.trim() || "System Administrator",
				passwordHash: await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 12),
				isActive: true,
				approvalStatus: "APPROVED",
				emailVerifiedAt: new Date(),
			},
		});
		await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
		await tx.accountLoginIdentifier.create({ data: { userId: user.id, type: "ADMIN_NUMBER", value: adminNumber } });
	}, { isolationLevel: "Serializable" });
	console.info(`Initial administrator created with login number ${adminNumber}.`);
}

main()
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	})
	.finally(async () => prisma.$disconnect());