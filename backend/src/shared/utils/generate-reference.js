import { randomBytes } from "node:crypto";

export function generateReference(now = new Date()) {
	const year = now.getUTCFullYear();
	const randomPart = randomBytes(5).toString("hex").toUpperCase();
	return `MM-${year}-${randomPart}`;
}
