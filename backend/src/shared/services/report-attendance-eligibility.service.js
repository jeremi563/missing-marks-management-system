import { academicYearBounds, academicYearForPeriod } from "../utils/academic-year.js";
import { evaluateConfiguredAttendanceEligibility } from "./eligibility.service.js";
import { getSystemSettingValue } from "./system-settings.service.js";

export function isAttendedStatus(status) {
	return ["PRESENT", "ATTENDED", "LATE"].includes(String(status).toUpperCase());
}

function getAssessmentGroupStatus(items) {
	if (items.some(({ status }) => status === "present")) return "present";
	if (items.some(({ status }) => status === "absent")) return "absent";
	return "unknown";
}

export async function getReportAttendanceReview(db, report) {
	const academicYear = academicYearForPeriod(report.academicPeriod);
	const bounds = academicYearBounds(academicYear);
	if (!bounds) {
		return {
			academicYear: null,
			assessments: {
				CAT: { status: "unknown", items: [] },
				EXAM: { status: "unknown", items: [] },
			},
			classAttendance: { attendedSessions: 0, applicableSessions: 0, percentage: null, minimumPercentage: null, meetsRequirement: null },
		};
	}

	const [assessments, classSessions] = await Promise.all([
		db.assessment.findMany({
			where: {
				courseUnitId: report.courseUnitId,
				type: { in: ["CAT", "EXAM"] },
				OR: [
					{ assessmentDate: { gte: bounds.startsAt, lt: bounds.endsAt } },
					{ sessions: { some: { startsAt: { gte: bounds.startsAt, lt: bounds.endsAt } } } },
				],
			},
			select: {
				id: true,
				code: true,
				name: true,
				type: true,
				attendanceRecords: {
					where: { studentProfileId: report.studentProfileId },
					select: { status: true },
				},
				sessions: {
					where: {
						sessionType: { in: ["CAT", "EXAM"] },
						status: "completed",
						startsAt: { gte: bounds.startsAt, lt: bounds.endsAt },
					},
					select: {
						id: true,
						records: {
							where: { studentProfileId: report.studentProfileId },
							select: { status: true },
						},
					},
				},
			},
		}),
		db.attendanceSession.findMany({
			where: {
				courseUnitId: report.courseUnitId,
				sessionType: "CLASS",
				status: "completed",
				startsAt: { gte: bounds.startsAt, lt: bounds.endsAt },
			},
			select: {
				id: true,
				records: {
					where: { studentProfileId: report.studentProfileId },
					select: { status: true },
				},
			},
		}),
	]);

	const assessmentGroups = Object.fromEntries(["CAT", "EXAM"].map((type) => {
		const items = assessments
			.filter((assessment) => assessment.type.toUpperCase() === type)
			.map((assessment) => {
				const hasAttendedRecord = assessment.attendanceRecords.some(({ status }) => isAttendedStatus(status))
					|| assessment.sessions.some((session) => session.records.some(({ status }) => isAttendedStatus(status)));
				const hasExplicitAbsentRecord = assessment.attendanceRecords.some(({ status }) => String(status).toUpperCase() === "ABSENT");
				const status = hasAttendedRecord
					? "present"
					: hasExplicitAbsentRecord || assessment.sessions.length > 0
						? "absent"
						: "unknown";
				return {
					assessmentId: assessment.id,
					name: assessment.name,
					code: assessment.code,
					status,
					completedSessions: assessment.sessions.length,
				};
			});
		return [type, { status: getAssessmentGroupStatus(items), items }];
	}));

	const attendedSessions = classSessions.filter((session) => session.records.some(({ status }) => isAttendedStatus(status))).length;
	let classAttendance;
	if (classSessions.length > 0) {
		classAttendance = await evaluateConfiguredAttendanceEligibility({
			db,
			attendedSessions,
			applicableSessions: classSessions.length,
		});
	} else {
		const configuredThreshold = await getSystemSettingValue(db, "attendance_minimum_percentage", 80);
		classAttendance = {
			percentage: null,
			meetsRequirement: null,
			minimumPercentage: typeof configuredThreshold === "number" && configuredThreshold >= 0 && configuredThreshold <= 100
				? configuredThreshold
				: 80,
		};
	}

	return {
		academicYear,
		assessments: assessmentGroups,
		classAttendance: {
			attendedSessions,
			applicableSessions: classSessions.length,
			...classAttendance,
		},
	};
}

export function getReportAttendanceRequirements(attendanceReview) {
	const { classAttendance, assessments } = attendanceReview;
	const classMet = classAttendance.meetsRequirement === true;
	const catMet = assessments.CAT.status === "present";
	const examMet = assessments.EXAM.status === "present";
	const classMessage = classAttendance.applicableSessions === 0
		? `Class attendance: not confirmed; no completed class sessions are available (at least ${classAttendance.minimumPercentage ?? 80}% is required).`
		: `Class attendance: ${classMet ? "met" : "not met"}; attended ${classAttendance.attendedSessions} of ${classAttendance.applicableSessions} completed sessions (${classAttendance.percentage}%; ${classAttendance.minimumPercentage}% required).`;

	return [
		{ path: "classAttendance", met: classMet, message: classMessage },
		{
			path: "catAttendance",
			met: catMet,
			message: `CAT attendance: ${catMet ? "met" : assessments.CAT.status === "absent" ? "not met" : "not confirmed"}; attendance at at least one CAT session is required.`,
		},
		{
			path: "examAttendance",
			met: examMet,
			message: `Exam attendance: ${examMet ? "met" : assessments.EXAM.status === "absent" ? "not met" : "not confirmed"}; exam attendance is required.`,
		},
	];
}
