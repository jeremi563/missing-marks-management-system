import test from "node:test";
import assert from "node:assert/strict";
import {
	decideCodDepartmentMembershipRequest,
	getLecturerDepartmentOptions,
	listCodDepartmentMembershipRequests,
} from "../../src/modules/department-membership/department-membership.service.js";

const lecturerUserId = "00000000-0000-4000-8000-000000000001";
const codUserId = "00000000-0000-4000-8000-000000000002";
const departmentId = "00000000-0000-4000-8000-000000000003";
const requestId = "00000000-0000-4000-8000-000000000004";

test("lists departments from course units assigned to the lecturer", async () => {
	const prisma = {
		lecturerProfile: {
			findUnique: async () => ({
				unitAssignments: [{ courseUnit: { department: { id: departmentId, name: "Computing", code: "COMP" } } }],
			}),
		},
	};

	const result = await getLecturerDepartmentOptions(prisma, lecturerUserId);

	assert.deepEqual(result.assignedDepartments, [{ id: departmentId, name: "Computing", code: "COMP" }]);
});

test("limits the COD inbox to departments currently designated to that COD", async () => {
	let query;
	const prisma = {
		departmentMembership: { findMany: async () => [{ departmentId }] },
		user: { findFirst: async () => ({ id: codUserId }) },
		department: { findMany: async () => [{ id: departmentId }] },
		departmentMembershipRequest: { findMany: async (args) => { query = args; return []; } },
	};

	await listCodDepartmentMembershipRequests(prisma, codUserId);

	assert.deepEqual(query.where, {
		departmentId: { in: [departmentId] },
		status: "PENDING",
		lecturer: { isActive: true, approvalStatus: "APPROVED" },
	});
});

test("COD approval adds the department membership and records the decision", async () => {
	let membershipCreated = false;
	let requestDecision;
	let notification;
	const tx = {
		departmentMembershipRequest: {
			findUnique: async () => ({
				id: requestId,
				lecturerUserId,
				departmentId,
				status: "PENDING",
				lecturer: { isActive: true, approvalStatus: "APPROVED" },
				department: { name: "Computing", designatedCodUserId: codUserId },
			}),
			updateMany: async ({ data }) => { requestDecision = data; return { count: 1 }; },
		},
		user: { findFirst: async () => ({ id: codUserId }) },
		departmentMembership: {
			findMany: async () => [{ departmentId }],
			upsert: async () => { membershipCreated = true; },
		},
		department: { findMany: async () => [{ id: departmentId }] },
		auditLog: { create: async ({ data }) => data },
		notification: { create: async ({ data }) => { notification = data; } },
	};

	const result = await decideCodDepartmentMembershipRequest(
		{ $transaction: async (callback) => callback(tx) },
		codUserId,
		requestId,
		"APPROVED",
	);

	assert.equal(result.status, "APPROVED");
	assert.equal(membershipCreated, true);
	assert.equal(requestDecision.status, "APPROVED");
	assert.equal(notification.userId, lecturerUserId);
});

test("does not allow additional department decisions before primary COD approval", async () => {
	const tx = {
		departmentMembershipRequest: {
			findUnique: async () => ({
				id: requestId,
				lecturerUserId,
				departmentId,
				status: "PENDING",
				lecturer: { isActive: false, approvalStatus: "PENDING" },
				department: { name: "Computing", designatedCodUserId: codUserId },
			}),
		},
	};

	await assert.rejects(
		decideCodDepartmentMembershipRequest(
			{ $transaction: async (callback) => callback(tx) },
			codUserId,
			requestId,
			"APPROVED",
		),
		{ statusCode: 409 },
	);
});
