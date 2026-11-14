const ACADEMIC_YEAR_START_MONTH = 7;

export function academicYearForDate(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.valueOf())) return null;
	const startYear = date.getUTCFullYear() - (date.getUTCMonth() < ACADEMIC_YEAR_START_MONTH ? 1 : 0);
	return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

export function academicYearForPeriod(period) {
	if (period.startsAt) return academicYearForDate(period.startsAt);
	const periodText = `${period.name || ""} ${period.code || ""}`;
	const explicitAcademicYear = periodText.match(/\b(20\d{2})\s*[/-]\s*(?:20)?(\d{2})\b/);
	if (explicitAcademicYear) return `${explicitAcademicYear[1]}/${explicitAcademicYear[2]}`;
	const year = periodText.match(/\b(20\d{2})\b/);
	return year ? `${year[1]}/${String(Number(year[1]) + 1).slice(-2)}` : null;
}
