import { getSystemSettingValue } from "./system-settings.service.js";

function assertCount(value, name) {
	if (!Number.isInteger(value) || value < 0) {
		throw new RangeError(`${name} must be a non-negative integer`);
	}
}

export function calculateAttendancePercentage(attendedSessions, applicableSessions) {
	assertCount(attendedSessions, "attendedSessions");
	assertCount(applicableSessions, "applicableSessions");
	if (applicableSessions === 0) throw new RangeError("applicableSessions must be greater than zero");
	if (attendedSessions > applicableSessions) throw new RangeError("attendedSessions cannot exceed applicableSessions");
	return Math.round((attendedSessions / applicableSessions) * 10000) / 100;
}

export function evaluateAttendanceEligibility({ attendedSessions, applicableSessions, minimumPercentage }) {
	if (typeof minimumPercentage !== "number" || minimumPercentage < 0 || minimumPercentage > 100) {
		throw new RangeError("minimumPercentage must be between 0 and 100");
	}
	const percentage = calculateAttendancePercentage(attendedSessions, applicableSessions);
	return { percentage, meetsRequirement: percentage >= minimumPercentage };
}

export async function evaluateConfiguredAttendanceEligibility({ db, attendedSessions, applicableSessions }) {
	const configuredThreshold = await getSystemSettingValue(db, "attendance_minimum_percentage", 80);
	const minimumPercentage = typeof configuredThreshold === "number" && configuredThreshold >= 0 && configuredThreshold <= 100 ? configuredThreshold : 80;
	return evaluateAttendanceEligibility({ attendedSessions, applicableSessions, minimumPercentage });
}
