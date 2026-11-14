import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";
import { academicYearForDate } from "../src/shared/utils/academic-year.js";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "../src/shared/utils/password-policy.js";

const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!meetsPasswordPolicy(demoPassword)) {
	throw new Error(`Set DEMO_SEED_PASSWORD to a strong, non-production value before seeding. ${PASSWORD_POLICY_MESSAGE}`);
}

const demoUsers = [
	{ email: "admin@example.test", displayName: "Demo Administrator", role: "administrator", identifierType: "ADMIN_NUMBER", identifier: "DEMO-ADMIN-001" },
	{ email: "cod@example.test", displayName: "Demo Academic Officer", role: "cod", identifierType: "STAFF_NUMBER", identifier: "DEMO-COD-001" },
	{ email: "lecturer@example.test", displayName: "Demo Lecturer", role: "lecturer", identifierType: "STAFF_NUMBER", identifier: "DEMO-STAFF-001" },
	{ email: "student@example.test", displayName: "Demo Student", role: "student", identifierType: "STUDENT_NUMBER", identifier: "DEMO-STU-001" },
];

async function ensureUser({ email, displayName, role, identifierType, identifier, passwordHash }) {
	return prisma.$transaction(async (tx) => {
		if (role === "administrator") {
			await tx.$queryRaw`SELECT pg_advisory_xact_lock(37037002) IS NULL AS locked`;
			const [existingUser, administratorCount] = await Promise.all([
				tx.user.findUnique({ where: { email }, select: { roles: { select: { role: { select: { name: true } } } } } }),
				tx.user.count({ where: { roles: { some: { role: { name: "administrator" } } } } }),
			]);
			const alreadyAdministrator = existingUser?.roles.some(({ role: userRole }) => userRole.name === "administrator");
			if (!alreadyAdministrator && administratorCount >= 2) {
				throw new Error("The system can have at most two administrator accounts; demo administrator was not created.");
			}
		}
		const roleRecord = await tx.role.upsert({
			where: { name: role },
			update: {},
			create: { name: role, description: `Synthetic demo ${role} role` },
		});
		const user = await tx.user.upsert({
			where: { email },
			update: { displayName, isActive: true, approvalStatus: "APPROVED", emailVerifiedAt: new Date() },
			create: { email, displayName, passwordHash, approvalStatus: "APPROVED", emailVerifiedAt: new Date() },
		});
		await tx.userRole.upsert({
			where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } },
			update: {},
			create: { userId: user.id, roleId: roleRecord.id },
		});
		const existingIdentifier = await tx.accountLoginIdentifier.findUnique({ where: { value: identifier } });
		if (existingIdentifier && existingIdentifier.userId !== user.id) throw new Error(`Demo login identifier ${identifier} is already assigned`);
		const userIdentifier = await tx.accountLoginIdentifier.findFirst({ where: { userId: user.id, type: identifierType } });
		if (userIdentifier) await tx.accountLoginIdentifier.update({ where: { id: userIdentifier.id }, data: { value: identifier } });
		else await tx.accountLoginIdentifier.create({ data: { userId: user.id, type: identifierType, value: identifier } });
		return user;
	});
}

async function main() {
	const passwordHash = await bcrypt.hash(demoPassword, 12);
	const users = new Map();
	for (const demoUser of demoUsers) {
		users.set(demoUser.role, await ensureUser({ ...demoUser, passwordHash }));
	}

	const student = await prisma.studentProfile.upsert({
		where: { studentNumber: "DEMO-STU-001" },
		update: { officialEmail: "student@university.example.test", notificationEmail: "student@example.test" },
		create: {
			userId: users.get("student").id,
			studentNumber: "DEMO-STU-001",
			officialEmail: "student@university.example.test",
			notificationEmail: "student@example.test",
		},
	});
	const lecturer = await prisma.lecturerProfile.upsert({
		where: { userId: users.get("lecturer").id },
		update: { staffNumber: "DEMO-STAFF-001" },
		create: { userId: users.get("lecturer").id, staffNumber: "DEMO-STAFF-001" },
	});

	const department = await prisma.department.upsert({
		where: { code: "DEMO" },
		update: { name: "Demo Department", designatedCodUserId: users.get("cod").id },
		create: { code: "DEMO", name: "Demo Department", designatedCodUserId: users.get("cod").id },
	});
	await prisma.departmentMembership.upsert({
		where: { userId_departmentId: { userId: users.get("cod").id, departmentId: department.id } },
		update: {},
		create: { userId: users.get("cod").id, departmentId: department.id },
	});
	const courseUnit = await prisma.courseUnit.upsert({
		where: { departmentId_code: { departmentId: department.id, code: "DEMO101" } },
		update: { name: "Demo Course Unit" },
		create: { departmentId: department.id, code: "DEMO101", name: "Demo Course Unit" },
	});
	const academicPeriod = await prisma.academicPeriod.upsert({
		where: { code: "DEMO-PERIOD-2026" },
		update: {},
		create: { code: "DEMO-PERIOD-2026", name: "Demo Academic Period" },
	});
	const academicYear = academicYearForDate(new Date());
	await prisma.courseUnitLecturer.upsert({
		where: { courseUnitId_academicYear: { courseUnitId: courseUnit.id, academicYear } },
		update: {},
		create: { courseUnitId: courseUnit.id, lecturerProfileId: lecturer.id, academicYear },
	});
	await prisma.unitEnrollment.upsert({
		where: {
			studentProfileId_courseUnitId_academicPeriodId: {
				studentProfileId: student.id,
				courseUnitId: courseUnit.id,
				academicPeriodId: academicPeriod.id,
			},
		},
		update: {},
		create: { studentProfileId: student.id, courseUnitId: courseUnit.id, academicPeriodId: academicPeriod.id },
	});

	const assessmentTypes = [
		["CAT", "CAT"], ["MAIN_EXAMINATION", "Main Examination"], ["ASSIGNMENT", "Assignment"],
		["PRACTICAL", "Practical"], ["SUPPLEMENTARY_EXAMINATION", "Supplementary Examination"],
		["SPECIAL_EXAMINATION", "Special Examination"], ["OTHER", "Other"],
	];
	for (const [code, name] of assessmentTypes) {
		await prisma.assessmentType.upsert({ where: { code }, update: { name, isActive: true }, create: { code, name } });
	}

	const categories = [
		["LECTURER_UNAVAILABLE", "Lecturer Unavailable"], ["ASSESSMENT_RECORDS_ISSUE", "Assessment Records Issue"],
		["MARKS_SUBMISSION_PROBLEM", "Marks Submission Problem"], ["SYSTEM_OR_TECHNICAL_ISSUE", "System or Technical Issue"],
		["ADMINISTRATIVE_ISSUE", "Administrative Issue"], ["OTHER", "Other"],
	];
	for (const [code, name] of categories) {
		await prisma.specialCaseCategory.upsert({ where: { name }, update: { code, isActive: true }, create: { code, name } });
	}

	console.info("Synthetic demo accounts and academic structure are ready.");
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
