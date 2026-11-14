const currentYear = new Date().getFullYear();

const isValidYear = (value) => {
	const year = Number(value);
	return Number.isInteger(year) && year >= 1000 && year <= currentYear;
};

export function isStudentRegistrationNumber(value) {
	return Boolean(parseStudentRegistrationNumber(value));
}

export function parseStudentRegistrationNumber(value, currentYear = new Date().getFullYear()) {
	const match = /^([a-z]{2})(\d{2})\/(\d{5})\/(\d{2})$/i.exec(value?.trim() ?? "");
	if (!match) return null;
	const admissionYear = Number(match[4]);
	if (admissionYear < 13 || admissionYear > currentYear % 100) return null;
	return {
		departmentInitials: match[1].toUpperCase(),
		courseCode: match[2],
		uniqueNumber: match[3],
		admissionYear,
	};
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
