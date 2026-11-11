import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/database.js");
const uniqueSuffix = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const createUser = async ({ email, passwordHash = "hashed-password", roles = [] }) => {
  const uniqueEmail = email.replace("@", `-${uniqueSuffix()}@`);
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail,
      displayName: uniqueEmail.split("@")[0],
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

const createDepartment = async ({ name, code }) => prisma.department.create({ data: { name, code: code ? `${code}-${uniqueSuffix()}` : code } });

const createDepartmentMembership = async ({ userId, departmentId }) => prisma.departmentMembership.create({ data: { userId, departmentId } });

const createCourseUnit = async ({ departmentId, code, name }) => prisma.courseUnit.create({ data: { departmentId, code, name } });

const createAcademicPeriod = async ({ name }) => prisma.academicPeriod.create({ data: { name } });

const createStudentProfile = async ({ userEmail, studentNumber }) => {
  const uniqueEmail = userEmail.replace("@", `-${uniqueSuffix()}@`);
  const uniqueStudentNumber = `${studentNumber}-${uniqueSuffix()}`;
  return prisma.studentProfile.create({
  data: {
    user: {
      connectOrCreate: {
        where: { email: uniqueEmail },
        create: {
          email: uniqueEmail,
          displayName: uniqueEmail.split("@")[0],
          passwordHash: "hashed-password",
        },
      },
    },
    studentNumber: uniqueStudentNumber,
    officialEmail: uniqueEmail,
  },
});
};

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

test("COD report detail returns linked application enrollment, assessment, CAT and attendance records", async () => {
  const department = await createDepartment({ name: "Review Department", code: "REV" });
  const codUser = await createUser({ email: "cod.review@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: department.id });
  const secondDepartment = await createDepartment({ name: "Second Review Department", code: "REV2" });
  await createDepartmentMembership({ userId: codUser.id, departmentId: secondDepartment.id });
  const courseUnit = await createCourseUnit({ departmentId: department.id, code: "REV101", name: "Review Unit" });
  const academicPeriod = await createAcademicPeriod({ name: "Review Period" });
  const student = await createStudentProfile({ userEmail: "review.student@example.com", studentNumber: "REV001" });
  const otherStudent = await createStudentProfile({ userEmail: "review.other.student@example.com", studentNumber: "REV002" });
  const assessment = await prisma.assessment.create({
    data: { courseUnitId: courseUnit.id, name: "CAT 1", type: "CAT", attendanceRequired: true, submissionRequired: true },
  });
  const report = await prisma.missingMarkReport.create({
    data: {
      reference: `REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      studentProfileId: student.id,
      courseUnitId: courseUnit.id,
      academicPeriodId: academicPeriod.id,
      assessmentId: assessment.id,
      assessmentComponent: "CAT 1",
      description: "Review linked academic information",
      status: "submitted",
    },
  });
  await prisma.unitEnrollment.create({
    data: { studentProfileId: student.id, courseUnitId: courseUnit.id, academicPeriodId: academicPeriod.id },
  });
  const catSubmission = await prisma.catSubmission.create({ data: { assessmentId: assessment.id, studentProfileId: student.id } });
  const assessmentAttendance = await prisma.assessmentAttendance.create({ data: { assessmentId: assessment.id, studentProfileId: student.id, status: "present" } });
  await prisma.catSubmission.create({ data: { assessmentId: assessment.id, studentProfileId: otherStudent.id } });
  await prisma.assessmentAttendance.create({ data: { assessmentId: assessment.id, studentProfileId: otherStudent.id, status: "absent" } });

  const otherCourseUnit = await createCourseUnit({ departmentId: department.id, code: "REV102", name: "Other Review Unit" });
  const otherAssessment = await prisma.assessment.create({
    data: { courseUnitId: otherCourseUnit.id, name: "Other Unit CAT", type: "CAT" },
  });
  const mismatchedReport = await prisma.missingMarkReport.create({
    data: {
      reference: `REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      studentProfileId: student.id,
      courseUnitId: courseUnit.id,
      academicPeriodId: academicPeriod.id,
      assessmentId: otherAssessment.id,
      assessmentComponent: "CAT 1",
      description: "Report linked to an assessment from another unit",
      status: "submitted",
    },
  });

  const token = await loginToken(codUser);
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/cod/reports/${report.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.academicReview.source, "Application records; not independently verified official university records");
    assert.match(body.data.academicReview.note, /does not establish/i);
    assert.ok(body.data.academicReview.enrollment.id);
    assert.equal(body.data.academicReview.assessment.id, assessment.id);
    assert.equal(body.data.academicReview.assessment.catSubmissions.length, 1);
    assert.equal(body.data.academicReview.assessment.catSubmissions[0].id, catSubmission.id);
    assert.equal(body.data.academicReview.assessment.attendance[0].status, "present");
    assert.equal(body.data.academicReview.assessment.attendance[0].id, assessmentAttendance.id);
    assert.equal(body.data.status, "submitted");

    const mismatchedResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/cod/reports/${mismatchedReport.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(mismatchedResponse.status, 200);
    const mismatchedBody = await mismatchedResponse.json();
    assert.equal(mismatchedBody.data.academicReview.assessment, null);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD report detail and comments do not expose reports from unauthorized departments", async () => {
  const departmentA = await createDepartment({ name: "Authorized Review", code: "AR1" });
  const departmentB = await createDepartment({ name: "Restricted Review", code: "RR1" });
  const codUser = await createUser({ email: "cod.scope.review@dept.test", roles: ["cod"] });
  await createDepartmentMembership({ userId: codUser.id, departmentId: departmentA.id });
  const course = await createCourseUnit({ departmentId: departmentB.id, code: "RR101", name: "Restricted Unit" });
  const period = await createAcademicPeriod({ name: "Restricted Period" });
  const student = await createStudentProfile({ userEmail: "restricted.review@example.com", studentNumber: "RR001" });
  const report = await createMissingMarkReport({ studentProfileId: student.id, courseUnitId: course.id, academicPeriodId: period.id, assessmentComponent: "Exam", status: "submitted", description: "Restricted" });
  const token = await loginToken(codUser);
  const server = app.listen(0);
  try {
    for (const path of [`/api/v1/cod/reports/${report.id}`, `/api/v1/cod/reports/${report.id}/comments`]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 404);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("COD report detail requires authentication and COD role", async () => {
  const department = await createDepartment({ name: "Auth Review", code: "AUTHR" });
  const course = await createCourseUnit({ departmentId: department.id, code: "AUTH101", name: "Auth Unit" });
  const period = await createAcademicPeriod({ name: "Auth Period" });
  const student = await createStudentProfile({ userEmail: "auth.review@example.com", studentNumber: "AUTH001" });
  const report = await createMissingMarkReport({ studentProfileId: student.id, courseUnitId: course.id, academicPeriodId: period.id, assessmentComponent: "Exam", status: "submitted", description: "Auth" });
  const nonCod = await createUser({ email: "noncod.review@dept.test", roles: ["student"] });
  const server = app.listen(0);
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/cod/reports/${report.id}`;
    assert.equal((await fetch(baseUrl)).status, 401);
    assert.equal((await fetch(baseUrl, { headers: { Authorization: `Bearer ${await loginToken(nonCod)}` } })).status, 403);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

process.on("exit", async () => {
  await prisma.$disconnect();
});
