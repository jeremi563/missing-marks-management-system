import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "******localhost:5432/test?schema=public";
const { codRoutes } = await import("../../src/modules/cod/cod.routes.js");

test("COD can reassign reports but does not expose a separate assignment lookup endpoint", () => {
  const paths = codRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  assert.ok(paths.includes("/reports/:id/reassign"));
  assert.ok(!paths.includes("/reports/:id/eligible-lecturers"));
});
