import { AppError } from "../utils/app-error.js";

/** Locks the department row so review submissions and COD replacement serialize. */
export async function lockDepartmentForReview(tx, departmentId) {
	const rows = await tx.$queryRaw`
		SELECT id
		FROM departments
		WHERE id = ${departmentId}::uuid
		FOR UPDATE
	`;
	if (!rows.length) throw new AppError(404, "Department not found");
	return rows[0].id;
}
