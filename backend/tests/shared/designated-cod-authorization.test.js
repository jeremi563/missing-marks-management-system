import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
const { isActiveCodDepartmentMember, getDesignatedCodDepartmentIds } = await import("../../src/shared/services/designated-cod-authorization.service.js");
const { getAuthorizedDepartmentIds } = await import("../../src/modules/cod/cod.service.js");

function dbFixture({ memberships = ["dept-a", "dept-b"], active = true, cod = true, designated = ["dept-a"] } = {}) {
	const db = {
		departmentMembership: { findMany: async () => memberships.map((departmentId) => ({ departmentId })) },
		user: { findFirst: async ({ where }) => {
			if (where.departmentMemberships) return active && cod && memberships.includes(where.departmentMemberships.some.departmentId) ? { id: where.id } : null;
			return active && cod ? { id: where.id } : null;
		} },
		department: { findMany: async ({ where }) => designated.filter((id) => where.id.in.includes(id) && where.designatedCodUserId === "cod-1").map((id) => ({ id })) },
	};
	return db;
}

test("shared designated-COD helper preserves COD active, role, membership and designation gates", async () => {
	const db = dbFixture();
	assert.deepEqual(await getDesignatedCodDepartmentIds(db, "cod-1"), ["dept-a"]);
	assert.deepEqual(await getAuthorizedDepartmentIds(db, "cod-1"), ["dept-a"]);
	assert.equal(await isActiveCodDepartmentMember(db, "cod-1", "dept-a"), true);
	for (const invalid of [dbFixture({ active: false }), dbFixture({ cod: false }), dbFixture({ memberships: [] }), dbFixture({ designated: [] })]) {
		assert.deepEqual(await getDesignatedCodDepartmentIds(invalid, "cod-1"), []);
	}
});

test("shared member predicate does not grant a non-member or inactive/non-COD user access", async () => {
	assert.equal(await isActiveCodDepartmentMember(dbFixture({ memberships: [] }), "cod-1", "dept-a"), false);
	assert.equal(await isActiveCodDepartmentMember(dbFixture({ active: false }), "cod-1", "dept-a"), false);
	assert.equal(await isActiveCodDepartmentMember(dbFixture({ cod: false }), "cod-1", "dept-a"), false);
	assert.equal(await isActiveCodDepartmentMember(dbFixture(), null, "dept-a"), false);
});
