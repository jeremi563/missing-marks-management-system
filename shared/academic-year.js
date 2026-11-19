export const ACADEMIC_YEAR_TIME_ZONE = "Africa/Nairobi";

const zonedDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
	timeZone: ACADEMIC_YEAR_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
});

function getZonedParts(date) {
	const parts = Object.fromEntries(zonedDateTimeFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
		second: Number(parts.second),
	};
}

function toDate(value) {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.valueOf()) ? null : date;
}

export function academicYearForDate(value) {
	const date = toDate(value);
	if (!date) return null;
	const { year, month } = getZonedParts(date);
	const startYear = year - (month < 9 ? 1 : 0);
	return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

export function academicYearForPeriod(period) {
	return period?.academicYear || (period?.startsAt ? academicYearForDate(period.startsAt) : null);
}

export function nairobiDateAtStartOfDay(value) {
	const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	const [, yearText, monthText, dayText] = match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const target = Date.UTC(year, month - 1, day);
	const normalized = new Date(target);
	if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) return null;

	let instant = target;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const parts = getZonedParts(new Date(instant));
		const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
		instant += target - representedAsUtc;
	}
	return new Date(instant);
}

export function nairobiDateAtEndOfDay(value) {
	const start = nairobiDateAtStartOfDay(value);
	if (!start) return null;
	const [year, month, day] = value.split("-").map(Number);
	const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
	const nextDate = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;
	const nextStart = nairobiDateAtStartOfDay(nextDate);
	return nextStart ? new Date(nextStart.valueOf() - 1) : null;
}

export function academicYearBounds(academicYear) {
	const match = typeof academicYear === "string" && academicYear.match(/^(20\d{2})\/(\d{2})$/);
	if (!match) return null;
	const startYear = Number(match[1]);
	if (String(startYear + 1).slice(-2) !== match[2]) return null;
	const startsAt = nairobiDateAtStartOfDay(`${startYear}-09-01`);
	const endsAt = nairobiDateAtStartOfDay(`${startYear + 1}-09-01`);
	return startsAt && endsAt ? { startsAt, endsAt } : null;
}
