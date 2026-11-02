import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/database.js");

const createUser = async ({ email, passwordHash = "hashed-password", roles = [] }) => {
  const user = await prisma.user.create({
    data: {
      email,
      displayName: email.split("@")[0],
      passwordHash,
      roles: {
        create: roles.map((roleName) => ({
          role: {
            connectOrCreate: {
              where: { name: roleName },
              create: { name: roleName, description: roleName },
            },
          },
        })),
      },
    },
    include: { roles: { include: { role: true } } },
  });

  return user;
};

const createDepartment = async ({ name, code }) => prisma.department.create({ data: { name, code } });

const createDepartmentMembership = async ({ userId, departmentId }) => prisma.departmentMembership.create({ data: { userId, departmentId } });

const createCourseUnit = async ({ departmentId, code, name }) => prisma.courseUnit.create({ data: { departmentId, code, name } });

const createAcademicPeriod = async ({ name }) => prisma.academicPeriod.create({ data: { name } });

const createStudentProfile = async ({ userEmail, studentNumber }) => prisma.studentProfile.create({
  data: {
    user: {
      connectOrCreate: {
        where: { email: userEmail },
        create: {
          email: userEmail,
          displayName: userEmail.split("@")[0],
          passwordHash: "hashed-password",
        },
      },
    },
    studentNumber,
    officialEmail: userEmail,
  },
});

const createMissingMarkReport = async ({ studentProfileId, courseUnitId, academicPeriodId, assessmentComponent, status, description }) => prisma.missingMarkReport.create({
  data: {
    reference: `REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    studentProfileId,
    courseUnitId,
    academicPeriodId,
    assessmentComponent,
    description,
    status,
    submittedAt: new Date(),
  },
});

const loginToken = async (user) => {
  const jwt = await import("jsonwebtoken");
  return jwt.default.sign({ roles: user.roles.map(({ role }) => role.name) }, process.env.JWT_SECRET, { subject: user.id, expiresIn: "15m" });
};

const createCodWithReportsInDepartments = async ({ departmentIds, reportData = [] }) => {
  const codUser = await createUser({ email: `cod-${Math.random().toString(36).slice(2, 8)}@dept.test`, roles: ["cod"] });

  for (const departmentId of departmentIds) {
    await createDepartmentMembership({ userId: codUser.id, departmentId });
  }

  const academicPeriod = await createAcademicPeriod({ name: `Reporting Period ${Math.random().toString(36).slice(2, 8)}` });
  const studentProfile = await createStudentProfile({ userEmail: `student-${Math.random().toString(36).slice(2, 8)}@example.com`, studentNumber: `S-${Math.random().toString(36).slice(2, 8).toUpperCase()}` });

  for (const report of reportData) {
    await createMissingMarkReport({
      studentProfileId: studentProfile.id,
      courseUnitId: report.courseUnitId,
      academicPeriodId: academicPeriod.id,
      assessmentComponent: report.assessmentComponent,
      status: report.status,
      description: report.description,
    });
  }

  return { codUser, academicPeriod };
};

test("COD dashboard returns only reports from authorized departments", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS" });
  const departmentB = await createDepartment({ name: "Mathematics", code: "MATH" });
  const codUser = await createUser({ email: "cod@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });

  const courseA = await createCourseUnit({ departmentId: departmentA.id, code: "CS101", name: "Intro to CS" });
  const courseB = await createCourseUnit({ departmentId: departmentB.id, code: "MATH101", name: "Discrete Math" });
  const academicPeriod = await createAcademicPeriod({ name: "2026/2027 Semester 1" });

  const studentOne = await createStudentProfile({ userEmail: "student1@example.com", studentNumber: "S001" });
  const studentTwo = await createStudentProfile({ userEmail: "student2@example.com", studentNumber: "S002" });

  await createMissingMarkReport({
    studentProfileId: studentOne.id,
    courseUnitId: courseA.id,
    academicPeriodId: academicPeriod.id,
    assessmentComponent: "CAT 1",
    status: "submitted",
    description: "Missing marks in CS101",
  });

  await createMissingMarkReport({
    studentProfileId: studentTwo.id,
    courseUnitId: courseB.id,
    academicPeriodId: academicPeriod.id,
    assessmentComponent: "Assignment",
    status: "review",
    description: "Should not be visible",
  });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].courseUnit.departmentId, departmentA.id);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard allows access to all authorized departments for a multi-department COD", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS2" });
  const departmentB = await createDepartment({ name: "Mathematics", code: "MATH2" });
  const codUser = await createUser({ email: "cod.multi@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentB.id });

  const courseA = await createCourseUnit({ departmentId: departmentA.id, code: "CS201", name: "Algorithms" });
  const courseB = await createCourseUnit({ departmentId: departmentB.id, code: "MATH201", name: "Statistics" });
  const academicPeriod = await createAcademicPeriod({ name: "Multiple Department Period" });

  const studentOne = await createStudentProfile({ userEmail: "student_multi_1@example.com", studentNumber: "S101" });
  const studentTwo = await createStudentProfile({ userEmail: "student_multi_2@example.com", studentNumber: "S102" });

  await createMissingMarkReport({
    studentProfileId: studentOne.id,
    courseUnitId: courseA.id,
    academicPeriodId: academicPeriod.id,
    assessmentComponent: "CAT 1",
    status: "submitted",
    description: "Department A report",
  });

  await createMissingMarkReport({
    studentProfileId: studentTwo.id,
    courseUnitId: courseB.id,
    academicPeriodId: academicPeriod.id,
    assessmentComponent: "Final Exam",
    status: "resubmitted",
    description: "Department B report",
  });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 2);
    const departmentIds = body.data.items.map((item) => item.courseUnit.departmentId).sort();
    assert.deepEqual(departmentIds, [departmentA.id, departmentB.id].sort());
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard rejects a departmentId not assigned to the COD", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS3" });
  const departmentB = await createDepartment({ name: "Physics", code: "PHYS" });
  const codUser = await createUser({ email: "cod2@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports?departmentId=${departmentB.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /authorized department/i);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard rejects invalid department UUIDs", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS4" });
  const codUser = await createUser({ email: "cod3@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports?departmentId=not-a-valid-uuid`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard rejects invalid sort values", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS5" });
  const codUser = await createUser({ email: "cod4@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports?sort=banana`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard rejects invalid page and limit values", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS6" });
  const codUser = await createUser({ email: "cod5@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports?page=0&limit=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard filters reports by status", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS7" });
  const codUser = await createUser({ email: "cod6@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });

  const courseA = await createCourseUnit({ departmentId: departmentA.id, code: "CS301", name: "Operating Systems" });
  const academicPeriod = await createAcademicPeriod({ name: "Status Filter Period" });
  const studentOne = await createStudentProfile({ userEmail: "student_filter_1@example.com", studentNumber: "S201" });
  const studentTwo = await createStudentProfile({ userEmail: "student_filter_2@example.com", studentNumber: "S202" });

  await createMissingMarkReport({
    studentProfileId: studentOne.id,
    courseUnitId: courseA.id,
    academicPeriodId: academicPeriod.id,
    assessmentComponent: "CAT 1",
    status: "submitted",
    description: "Visible report",
  });

  await createMissingMarkReport({
    studentProfileId: studentTwo.id,
    courseUnitId: courseA.id,
    academicPeriodId: academicPeriod.id,
    assessmentComponent: "Assignment",
    status: "review",
    description: "Hidden report",
  });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports?status=submitted`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].status, "submitted");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard returns empty results when the COD has no department memberships", async () => {
  const codUser = await createUser({ email: "cod7@dept.test", roles: ["cod"] });
  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.items, []);
    assert.equal(body.data.total, 0);
    assert.equal(body.data.totalPages, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard returns zero-result pagination metadata when no reports match scope", async () => {
  const departmentA = await createDepartment({ name: "Computer Science", code: "CS8" });
  const codUser = await createUser({ email: "cod8@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });

  const token = await loginToken(codUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.items, []);
    assert.equal(body.data.total, 0);
    assert.equal(body.data.totalPages, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD dashboard rejects non-COD users", async () => {
  const studentUser = await createUser({ email: "student@dept.test", roles: ["student"] });
  const token = await loginToken(studentUser);
  const server = app.listen(0);

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cod/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /permission/i);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

process.on("exit", async () => {
  await prisma.$disconnect();
});
