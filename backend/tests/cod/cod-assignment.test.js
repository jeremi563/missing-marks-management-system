import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/database.js");

const makeKey = () => randomUUID().replaceAll("-", "").slice(0, 12);

const createUser = async (suffix, roles, isActive = true) => prisma.user.create({
  data: {
    email: `${suffix}-${makeKey()}@assignment.test`,
    displayName: suffix,
    passwordHash: "test-hash",
    isActive,
    roles: {
      create: roles.map((name) => ({
        role: {
          connectOrCreate: {
            where: { name },
            create: { name, description: name },
          },
        },
      })),
    },
  },
  include: { roles: { include: { role: true } } },
});

const createScenario = async () => {
  const key = makeKey();
  const cod = await createUser("cod", ["cod"]);
  const department = await prisma.department.create({ data: { name: `Department ${key}`, code: `D${key}` } });
  await prisma.departmentMembership.create({ data: { userId: cod.id, departmentId: department.id } });
  const otherDepartment = await prisma.department.create({ data: { name: `Other ${key}`, code: `O${key}` } });
  const courseUnit = await prisma.courseUnit.create({ data: { departmentId: department.id, code: `U${key}`, name: `Unit ${key}` } });
  const otherCourseUnit = await prisma.courseUnit.create({ data: { departmentId: otherDepartment.id, code: `V${key}`, name: `Other unit ${key}` } });
  const period = await prisma.academicPeriod.create({ data: { name: `Period ${key}` } });
  const studentUser = await createUser("student", []);
  const student = await prisma.studentProfile.create({
    data: { userId: studentUser.id, studentNumber: `S${key}` },
  });
  const report = await prisma.missingMarkReport.create({
    data: {
      reference: `R${key}`,
      studentProfileId: student.id,
      courseUnitId: courseUnit.id,
      academicPeriodId: period.id,
      assessmentComponent: "CAT 1",
      description: "Test report",
      status: "submitted",
    },
  });

  const makeLecturer = async ({ roles = ["lecturer"], active = true, unitId = courseUnit.id } = {}) => {
    const user = await createUser("lecturer", roles, active);
    const profile = await prisma.lecturerProfile.create({ data: { userId: user.id } });
    if (unitId) {
      await prisma.courseUnitLecturer.create({ data: { courseUnitId: unitId, lecturerProfileId: profile.id } });
    }
    return { user, profile };
  };

  return { cod, department, courseUnit, otherCourseUnit, report, makeLecturer };
};

const loginToken = async (user) => {
  const jwt = await import("jsonwebtoken");
  return jwt.default.sign({}, process.env.JWT_SECRET, { subject: user.id, expiresIn: "15m" });
};

const withServer = async (callback) => {
  const server = app.listen(0);
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
};

const request = async (baseUrl, path, token, options = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: {
    Authorization: `Bearer ${token}`,
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...options.headers,
  },
});

const assign = (baseUrl, token, reportId, lecturerProfileId) => request(
  baseUrl,
  `/api/v1/cod/reports/${reportId}/assign`,
  token,
  { method: "POST", body: JSON.stringify({ lecturerProfileId, reason: "Assignment review" }) },
);

test("assigns and reassigns a report while preserving assignment and audit history", async () => {
  const { cod, courseUnit, report, makeLecturer } = await createScenario();
  const first = await makeLecturer();
  const second = await makeLecturer();
  const token = await loginToken(cod);

  await withServer(async (baseUrl) => {
    const initialResponse = await assign(baseUrl, token, report.id, first.profile.id);
    assert.equal(initialResponse.status, 200);
    assert.equal((await initialResponse.json()).data.assignment.newLecturerProfileId, first.profile.id);

    const reassignResponse = await assign(baseUrl, token, report.id, second.profile.id);
    assert.equal(reassignResponse.status, 200);

    const [updatedReport, assignments, audits] = await Promise.all([
      prisma.missingMarkReport.findUnique({ where: { id: report.id } }),
      prisma.reportAssignment.findMany({ where: { reportId: report.id }, orderBy: { createdAt: "asc" } }),
      prisma.auditLog.findMany({ where: { entityType: "MissingMarkReport", entityId: report.id }, orderBy: { createdAt: "asc" } }),
    ]);

    assert.equal(updatedReport.assignedLecturerProfileId, second.profile.id);
    assert.equal(assignments.length, 2);
    assert.equal(assignments[0].actorUserId, cod.id);
    assert.equal(assignments[0].previousLecturerProfileId, null);
    assert.equal(assignments[0].newLecturerProfileId, first.profile.id);
    assert.equal(assignments[0].reason, "Assignment review");
    assert.equal(assignments[1].actorUserId, cod.id);
    assert.equal(assignments[1].previousLecturerProfileId, first.profile.id);
    assert.equal(assignments[1].newLecturerProfileId, second.profile.id);
    assert.deepEqual(audits.map(({ action }) => action), ["REPORT_ASSIGNED", "REPORT_REASSIGNED"]);
    assert.equal(audits[1].actorId, cod.id);
    assert.deepEqual(audits[1].metadata, {
      previousLecturerProfileId: first.profile.id,
      newLecturerProfileId: second.profile.id,
      reason: "Assignment review",
    });
    assert.equal(courseUnit.id, report.courseUnitId);
  });
});

test("eligible lecturer listing is limited to active lecturer-role mappings for the report unit", async () => {
  const { cod, report, courseUnit, otherCourseUnit, makeLecturer } = await createScenario();
  const eligible = await makeLecturer();
  const wrongUnit = await makeLecturer({ unitId: otherCourseUnit.id });
  const inactive = await makeLecturer({ active: false });
  const noRole = await makeLecturer({ roles: [] });
  const token = await loginToken(cod);

  await withServer(async (baseUrl) => {
    const response = await request(baseUrl, `/api/v1/cod/reports/${report.id}/eligible-lecturers`, token);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map(({ id }) => id), [eligible.profile.id]);
    assert.ok(!body.data.some(({ id }) => [wrongUnit.profile.id, inactive.profile.id, noRole.profile.id].includes(id)));
    assert.ok(courseUnit.id);
  });
});

test("rejects lecturers not mapped to the report unit, inactive lecturers, and users without lecturer role without changing records", async () => {
  const { cod, report, otherCourseUnit, makeLecturer } = await createScenario();
  const wrongUnit = await makeLecturer({ unitId: otherCourseUnit.id });
  const inactive = await makeLecturer({ active: false });
  const noRole = await makeLecturer({ roles: [] });
  const token = await loginToken(cod);

  await withServer(async (baseUrl) => {
    for (const candidate of [wrongUnit, inactive, noRole]) {
      const response = await assign(baseUrl, token, report.id, candidate.profile.id);
      assert.equal(response.status, 400);
    }
    const [unchanged, assignments, audits] = await Promise.all([
      prisma.missingMarkReport.findUnique({ where: { id: report.id } }),
      prisma.reportAssignment.count({ where: { reportId: report.id } }),
      prisma.auditLog.count({ where: { entityType: "MissingMarkReport", entityId: report.id } }),
    ]);
    assert.equal(unchanged.assignedLecturerProfileId, null);
    assert.equal(assignments, 0);
    assert.equal(audits, 0);
  });
});

test("rejects reports outside COD department scope", async () => {
  const { cod, otherCourseUnit, makeLecturer } = await createScenario();
  const eligibleElsewhere = await makeLecturer({ unitId: otherCourseUnit.id });
  const period = await prisma.academicPeriod.create({ data: { name: `Outside ${makeKey()}` } });
  const studentUser = await createUser("student", []);
  const student = await prisma.studentProfile.create({ data: { userId: studentUser.id, studentNumber: `S${makeKey()}` } });
  const report = await prisma.missingMarkReport.create({
    data: {
      reference: `R${makeKey()}`,
      studentProfileId: student.id,
      courseUnitId: otherCourseUnit.id,
      academicPeriodId: period.id,
      assessmentComponent: "Exam",
      description: "Out of scope",
      status: "submitted",
    },
  });
  const token = await loginToken(cod);

  await withServer(async (baseUrl) => {
    assert.equal((await assign(baseUrl, token, report.id, eligibleElsewhere.profile.id)).status, 403);
    assert.equal((await request(baseUrl, `/api/v1/cod/reports/${report.id}/eligible-lecturers`, token)).status, 403);
    assert.equal(await prisma.reportAssignment.count({ where: { reportId: report.id } }), 0);
  });
});

test("rejects non-COD users and malformed report or lecturer IDs", async () => {
  const { cod, report, makeLecturer } = await createScenario();
  const lecturer = await makeLecturer();
  const student = await createUser("other", ["student"]);
  const codToken = await loginToken(cod);
  const studentToken = await loginToken(student);

  await withServer(async (baseUrl) => {
    assert.equal((await assign(baseUrl, studentToken, report.id, lecturer.profile.id)).status, 403);
    assert.equal((await request(baseUrl, `/api/v1/cod/reports/not-a-uuid/eligible-lecturers`, codToken)).status, 400);
    assert.equal((await assign(baseUrl, codToken, "not-a-uuid", lecturer.profile.id)).status, 400);
    const invalidLecturer = await request(baseUrl, `/api/v1/cod/reports/${report.id}/assign`, codToken, {
      method: "POST",
      body: JSON.stringify({ lecturerProfileId: "not-a-uuid" }),
    });
    assert.equal(invalidLecturer.status, 400);
  });
});

process.on("exit", async () => {
  await prisma.$disconnect();
});
