import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-that-is-at-least-32-characters";

const { app } = await import("../../src/app.js");
const { prisma } = await import("../../src/config/database.js");
const unique = () => randomUUID().replaceAll("-", "").slice(0, 12);

async function makeUser(email, roles = []) {
  return prisma.user.create({
    data: {
      email,
      displayName: email.split("@")[0],
      passwordHash: "test-hash",
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
}

async function makeScenario() {
  const key = unique();
  const cod = await makeUser(`cod-${key}@comments.test`, ["cod"]);
  const department = await prisma.department.create({ data: { name: `Comments ${key}`, code: `C${key}` } });
  await prisma.departmentMembership.create({ data: { userId: cod.id, departmentId: department.id } });
  const course = await prisma.courseUnit.create({ data: { departmentId: department.id, code: `U${key}`, name: `Unit ${key}` } });
  const period = await prisma.academicPeriod.create({ data: { name: `Period ${key}` } });
  const studentUser = await makeUser(`student-${key}@comments.test`);
  const student = await prisma.studentProfile.create({ data: { userId: studentUser.id, studentNumber: `S${key}` } });
  const report = await prisma.missingMarkReport.create({
    data: {
      reference: `R${key}`,
      studentProfileId: student.id,
      courseUnitId: course.id,
      academicPeriodId: period.id,
      assessmentComponent: "CAT 1",
      description: "Comment test report",
      status: "submitted",
    },
  });
  const jwt = await import("jsonwebtoken");
  const token = jwt.default.sign({}, process.env.JWT_SECRET, { subject: cod.id, expiresIn: "15m" });
  return { cod, report, token };
}

async function withServer(callback) {
  const server = app.listen(0);
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("COD can add and list private comments with authenticated authorship and audit history", async () => {
  const { cod, report, token } = await makeScenario();
  await withServer(async (baseUrl) => {
    const created = await fetch(`${baseUrl}/api/v1/cod/reports/${report.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ body: "  Please check the assessment record.  " }),
    });
    assert.equal(created.status, 201);
    const { data: comment } = await created.json();
    assert.equal(comment.body, "Please check the assessment record.");
    assert.equal(comment.author.id, cod.id);
    assert.equal(comment.isStudentVisible, false);

    const [savedComment, audit] = await Promise.all([
      prisma.reportComment.findUnique({ where: { id: comment.id } }),
      prisma.auditLog.findFirst({ where: { entityType: "MissingMarkReport", entityId: report.id, action: "COD_REPORT_COMMENT_ADDED" } }),
    ]);
    assert.equal(savedComment.authorUserId, cod.id);
    assert.equal(savedComment.isStudentVisible, false);
    assert.equal(audit.actorId, cod.id);
    assert.deepEqual(audit.metadata, { commentId: comment.id });

    const listed = await fetch(`${baseUrl}/api/v1/cod/reports/${report.id}/comments`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json()).data.map(({ id }) => id), [comment.id]);
  });
});

test("COD comment body validation rejects empty, oversized, and unknown fields", async () => {
  const { report, token } = await makeScenario();
  await withServer(async (baseUrl) => {
    for (const body of [{ body: "  " }, { body: "x".repeat(2001) }, { body: "valid", authorUserId: randomUUID() }]) {
      const response = await fetch(`${baseUrl}/api/v1/cod/reports/${report.id}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    }
  });
});

test("COD comment endpoints reject unauthenticated and authenticated non-COD users", async () => {
  const { report } = await makeScenario();
  const nonCod = await makeUser(`noncod-${unique()}@comments.test`, ["student"]);
  const jwt = await import("jsonwebtoken");
  const nonCodToken = jwt.default.sign({}, process.env.JWT_SECRET, { subject: nonCod.id, expiresIn: "15m" });

  await withServer(async (baseUrl) => {
    for (const path of [
      `/api/v1/cod/reports/${report.id}/comments`,
    ]) {
      const unauthenticatedGet = await fetch(`${baseUrl}${path}`);
      assert.equal(unauthenticatedGet.status, 401);

      const nonCodGet = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${nonCodToken}` } });
      assert.equal(nonCodGet.status, 403);

      const unauthenticatedPost = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "A comment" }),
      });
      assert.equal(unauthenticatedPost.status, 401);

      const nonCodPost = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${nonCodToken}`, "content-type": "application/json" },
        body: JSON.stringify({ body: "A comment" }),
      });
      assert.equal(nonCodPost.status, 403);
    }
  });
});

test("COD comment endpoints reject invalid report UUIDs", async () => {
  const { token } = await makeScenario();
  await withServer(async (baseUrl) => {
    const path = `${baseUrl}/api/v1/cod/reports/not-a-uuid/comments`;
    const listed = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(listed.status, 400);

    const created = await fetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ body: "A comment" }),
    });
    assert.equal(created.status, 400);
  });
});

test("COD comment and audit write roll back together when the audit insert fails", async () => {
  const { report, token } = await makeScenario();
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = function (callback, ...options) {
    return originalTransaction.call(this, (tx) => callback(new Proxy(tx, {
      get(target, property, receiver) {
        if (property === "auditLog") {
          return new Proxy(Reflect.get(target, property, target), {
            get(auditDelegate, auditProperty, auditReceiver) {
              if (auditProperty === "create") return async () => { throw new Error("Simulated audit write failure"); };
              return Reflect.get(auditDelegate, auditProperty, auditReceiver);
            },
          });
        }
        return Reflect.get(target, property, target);
      },
    })), ...options);
  };
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/cod/reports/${report.id}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ body: "This should roll back." }),
      });
      assert.equal(response.status, 500);
    });
    assert.equal(await prisma.reportComment.count({ where: { reportId: report.id } }), 0);
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

process.on("exit", async () => {
  await prisma.$disconnect();
});
