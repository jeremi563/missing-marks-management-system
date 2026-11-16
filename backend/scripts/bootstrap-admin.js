import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { isAdminRegistrationNumber } from "../src/shared/utils/registration-number.js";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "../src/shared/utils/password-policy.js";

const { BOOTSTRAP_ADMIN_NUMBER, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME } = process.env;

async function main() {
	if (!BOOTSTRAP_ADMIN_NUMBER || !BOOTSTRAP_ADMIN_EMAIL || !meetsPasswordPolicy(BOOTSTRAP_ADMIN_PASSWORD)) {
		throw new Error(`Set BOOTSTRAP_ADMIN_NUMBER, BOOTSTRAP_ADMIN_EMAIL, and a strong BOOTSTRAP_ADMIN_PASSWORD. ${PASSWORD_POLICY_MESSAGE}`);
	}
	const email = BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
	const adminNumber = BOOTSTRAP_ADMIN_NUMBER.trim().toUpperCase();
	if (!isAdminRegistrationNumber(adminNumber)) {
		throw new Error("BOOTSTRAP_ADMIN_NUMBER must use the format admin/12/year, with a year no later than the current year.");
	}
	await prisma.$transaction(async (tx) => {
		await tx.$queryRaw`SELECT pg_advisory_xact_lock(37037002) IS NULL AS locked`;
		const administratorCount = await tx.user.count({ where: { roles: { some: { role: { name: "administrator" } } } } });
		if (administratorCount >= 2) throw new Error("The system can have at most two administrator accounts.");
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