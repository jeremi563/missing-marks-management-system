export function createEmailDatabase(users = []) {
	const tokens = [];
	const user = {
		findUnique: async ({ where }) => users.find((entry) => (
			(where.id && entry.id === where.id)
			|| (where.email && entry.email === where.email)
			|| (where.pendingEmail && entry.pendingEmail === where.pendingEmail)
		)) ?? null,
		update: async ({ where, data }) => {
			const entry = users.find(({ id }) => id === where.id);
			if (!entry) throw new Error("Missing synthetic user");
			for (const [key, value] of Object.entries(data)) {
				entry[key] = value?.increment ? entry[key] + value.increment : value;
			}
			return { ...entry };
		},
	};
	const accountSecurityToken = {
		findUnique: async ({ where }) => {
			const token = tokens.find((entry) => entry.tokenHash === where.tokenHash);
			if (!token) return null;
			return { ...token, user: users.find(({ id }) => id === token.userId) };
		},
		updateMany: async ({ where, data }) => {
			const matches = tokens.filter((token) => {
				if (where.id && token.id !== where.id) return false;
				if (where.userId && token.userId !== where.userId) return false;
				if (where.type && token.type !== where.type) return false;
				if (where.usedAt === null && token.usedAt !== null) return false;
				if (where.expiresAt?.gt && token.expiresAt <= where.expiresAt.gt) return false;
				return true;
			});
			for (const token of matches) Object.assign(token, data);
			return { count: matches.length };
		},
		create: async ({ data }) => {
			const token = { id: `security-token-${tokens.length + 1}`, usedAt: null, ...data };
			tokens.push(token);
			return { id: token.id };
		},
	};
	const tx = { user, accountSecurityToken, $queryRaw: async () => [] };
	return {
		users,
		tokens,
		user,
		accountSecurityToken,
		$transaction: async (callback) => callback(tx),
	};
}

export function makeSyntheticUser(overrides = {}) {
	return {
		id: "synthetic-user-1",
		email: "user@missingmarks.local",
		pendingEmail: null,
		displayName: "Synthetic User",
		passwordHash: "$2a$04$07HvGmnV4W5bZC6J8H3Tqu7m7R4j8Yqv9f1xw9zD4ZPLSR8s4n9/2",
		sessionVersion: 0,
		mustChangePassword: false,
		isActive: true,
		approvalStatus: "APPROVED",
		emailVerifiedAt: new Date(),
		roles: [{ role: { name: "student" } }],
		departmentMemberships: [],
		...overrides,
	};
}
