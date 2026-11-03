import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database.js";

const demoPassword = process.env.DEMO_SEED_PASSWORD;
if (!demoPassword || demoPassword.length < 12) {
	throw new Error("Set DEMO_SEED_PASSWORD to a non-production value of at least 12 characters before seeding.");
}

const demoUsers = [
	{ email: "admin@example.test", displayName: "Demo Administrator", role: "administrator" },
	{ email: "cod@example.test", displayName: "Demo Academic Officer", role: "cod" },
	{ email: "lecturer@example.test", displayName: "Demo Lecturer", role: "lecturer" },
	{ email: "student@example.test", displayName: "Demo Student", role: "student" },
];

async function ensureUser({ email, displayName, role, passwordHash }) {
	const roleRecord = await prisma.role.upsert({
		where: { name: role },
		update: {},
		create: { name: role, description: `Synthetic demo ${role} role` },
	});
	const user = await prisma.user.upsert({
		where: { email },
		update: { displayName, isActive: true },
		create: { email, displayName, passwordHash },
	});
	await prisma.userRole.upsert({
		where: { userId_roleId: { userId: user.id, roleId: roleRecord.id } },
		update: {},
		create: { userId: user.id, roleId: roleRecord.id },
	});
	return user;
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
		where: { staffNumber: "DEMO-STAFF-001" },
		update: {},
		create: { userId: users.get("lecturer").id, staffNumber: "DEMO-STAFF-001" },
	});

	const department = await prisma.department.upsert({
		where: { code: "DEMO" },
		update: { name: "Demo Department" },
		create: { code: "DEMO", name: "Demo Department" },
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
	await prisma.courseUnitLecturer.upsert({
		where: { courseUnitId_lecturerProfileId: { courseUnitId: courseUnit.id, lecturerProfileId: lecturer.id } },
		update: {},
		create: { courseUnitId: courseUnit.id, lecturerProfileId: lecturer.id },
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

	const assessment = await prisma.assessment.upsert({
    where: {
        courseUnitId_code: {
            courseUnitId: courseUnit.id,
            code: "DEMO-CAT-001",
        },
    },
    update: {
        name: "Demo CAT 1",
        type: "CAT",
        maximumMarks: 30,
    },
    create: {
        courseUnitId: courseUnit.id,
        code: "DEMO-CAT-001",
        name: "Demo CAT 1",
        type: "CAT",
        maximumMarks: 30,
    },
});

const classroom = await prisma.classroom.upsert({
    where: {
        name: "DEMO-CLASSROOM-001",
    },
    update: {
        latitude: 0,
        longitude: 0,
        boundaryMeters: 100,
        isActive: true,
    },
    create: {
        name: "DEMO-CLASSROOM-001",
        latitude: 0,
        longitude: 0,
        boundaryMeters: 100,
        isActive: true,
    },
});

console.info("Synthetic test classroom is ready:", classroom.name);

const correctionTestReport = await prisma.missingMarkReport.upsert({
    where: {
        reference: "DEMO-MM-CORRECTION-001",
    },
    update: {
        studentProfileId: student.id,
        courseUnitId: courseUnit.id,
        academicPeriodId: academicPeriod.id,
        assessmentId: assessment.id,
        assignedLecturerProfileId: lecturer.id,
        assessmentComponent: "CAT 1",
        description: "Synthetic report for mark-correction integration testing.",
        status: "APPROVED",
    },
    create: {
        reference: "DEMO-MM-CORRECTION-001",
        studentProfileId: student.id,
        courseUnitId: courseUnit.id,
        academicPeriodId: academicPeriod.id,
        assessmentId: assessment.id,
        assignedLecturerProfileId: lecturer.id,
        assessmentComponent: "CAT 1",
        description: "Synthetic report for mark-correction integration testing.",
        status: "APPROVED",
        submittedAt: new Date(),
    },
});

console.info(
    "Synthetic correction test report is ready:",
    correctionTestReport.reference
);

console.info("Synthetic demo assessment is ready:", assessment.code);

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
