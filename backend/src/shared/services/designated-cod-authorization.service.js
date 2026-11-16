export async function isActiveCodDepartmentMember(db, userId, departmentId) {
	if (!userId || !departmentId) return false;
	const user = await db.user.findFirst({
		where: {
			id: userId,
			isActive: true,
			roles: { some: { role: { name: "cod" } } },
			departmentMemberships: { some: { departmentId } },
		},
		select: { id: true },
	});
	return Boolean(user);
}

export async function getDesignatedCodDepartmentIds(db, userId) {
	if (!userId) return [];
	const memberships = await db.departmentMembership.findMany({
		where: { userId },
		select: { departmentId: true },
	});
	const departmentIds = memberships.map(({ departmentId }) => departmentId);
	if (!departmentIds.length) return [];
	const activeCod = await db.user.findFirst({
		where: { id: userId, isActive: true, roles: { some: { role: { name: "cod" } } } },
		select: { id: true },
	});
	if (!activeCod) return [];
	const designated = await db.department.findMany({
		where: { id: { in: departmentIds }, designatedCodUserId: userId },
		select: { id: true },
	});
	return designated.map(({ id }) => id);
}
