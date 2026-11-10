const currentYear = new Date().getFullYear();

const isValidYear = (value) => {
	const year = Number(value);
	return Number.isInteger(year) && year >= 1000 && year <= currentYear;
};

export function isStudentRegistrationNumber(value) {
	const match = /^([a-z]{2})\/(\d{5})\/(\d{4})$/i.exec(value?.trim() ?? "");
	return Boolean(match && isValidYear(match[3]));
}

export function isStaffRegistrationNumber(value) {
	return /^([a-z]{2})\/(\d{4})\/([a-z0-9-]+)$/i.test(value?.trim() ?? "");
}

export function isAdminRegistrationNumber(value) {
	const match = /^admin\/(\d{2})\/(\d{4})$/i.exec(value?.trim() ?? "");
	return Boolean(match && isValidYear(match[2]));
}

export function normalizeRegistrationNumber(value) {
	return value.trim().toUpperCase();
}
