const TIME_ZONE = "Africa/Nairobi";
const formatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: TIME_ZONE,
	year: "numeric", month: "2-digit", day: "2-digit",
	hour: "2-digit", minute: "2-digit", second: "2-digit",
	hourCycle: "h23",
});

function partsAt(date) {
	return Object.fromEntries(formatter.formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]));
}

function dateKey(year, month, day) {
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateKey(date) {
	const p = partsAt(date);
	return dateKey(p.year, p.month, p.day);
}

function zonedDateTimeToUtc({ year, month, day, hour, minute, second, millisecond = 0 }) {
	const desired = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
	let guess = desired;
	for (let i = 0; i < 3; i += 1) {
		const p = partsAt(new Date(guess));
		const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, millisecond);
		guess += desired - represented;
	}
	return new Date(guess);
}

function holidayKey(value) {
	if (typeof value === "string") return value.slice(0, 10);
	if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
	throw new TypeError("Holiday dates must be ISO date strings or valid Date values.");
}

/** Adds eligible Nairobi working days while preserving the Nairobi local clock time. */
export function addWorkingDays(startAt, workingDays, holidays = []) {
	const start = startAt instanceof Date ? startAt : new Date(startAt);
	if (Number.isNaN(start.valueOf())) throw new TypeError("Start time must be a valid date.");
	if (!Number.isInteger(workingDays) || workingDays < 0) throw new TypeError("Working days must be a non-negative integer.");
	if (workingDays === 0) return new Date(start);
	const holidaysSet = new Set(holidays.map(holidayKey));
	const p = partsAt(start);
	let cursor = new Date(Date.UTC(p.year, p.month - 1, p.day));
	let remaining = workingDays;
	while (remaining > 0) {
		cursor.setUTCDate(cursor.getUTCDate() + 1);
		const weekday = cursor.getUTCDay();
		const key = dateKey(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
		if (weekday === 0 || weekday === 6 || holidaysSet.has(key)) continue;
		remaining -= 1;
	}
	return zonedDateTimeToUtc({
		year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate(),
		hour: p.hour, minute: p.minute, second: p.second, millisecond: start.getUTCMilliseconds(),
	});
}

export function localDateKeyForNairobi(date) {
	const value = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(value.valueOf())) throw new TypeError("Date must be valid.");
	return localDateKey(value);
}

export function isWorkingDay(date, holidays = []) {
	const value = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(value.valueOf())) throw new TypeError("Date must be valid.");
	const p = partsAt(value);
	const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
	return weekday !== 0 && weekday !== 6 && !new Set(holidays.map(holidayKey)).has(dateKey(p.year, p.month, p.day));
}

export function isOverdue(deadlineAt, now = new Date()) {
	const deadline = deadlineAt instanceof Date ? deadlineAt : new Date(deadlineAt);
	const current = now instanceof Date ? now : new Date(now);
	if (Number.isNaN(deadline.valueOf()) || Number.isNaN(current.valueOf())) throw new TypeError("Deadline and current time must be valid dates.");
	return current.valueOf() > deadline.valueOf();
}

export const BUSINESS_TIME_ZONE = TIME_ZONE;
