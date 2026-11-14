import { AppError } from "../utils/app-error.js";
import { academicYearForDate } from "../utils/academic-year.js";

export function getAttendanceDiscrepancySourceType(input) {
	const sourceIds = ["attendanceRecordId", "assessmentAttendanceId", "attendanceAttemptId"].filter((key) => input[key]);
	if (sourceIds.length !== 1) throw new AppError(400, "Exactly one attendance source is required");
	return sourceIds[0];
}

export async function loadAttendanceDiscrepancySource(db, input) {
	const sourceType = getAttendanceDiscrepancySourceType(input);
	let source;
	if (sourceType === "attendanceRecordId") {
		source = await db.attendanceRecord.findUnique({
			where: { id: input.attendanceRecordId },
			select: { id: true, studentProfileId: true, status: true, session: { select: { id: true, courseUnitId: true, lecturerProfileId: true, startsAt: true, courseUnit: { select: { departmentId: true } } } } },
		});
	} else if (sourceType === "assessmentAttendanceId") {
		source = await db.assessmentAttendance.findUnique({
			where: { id: input.assessmentAttendanceId },
			select: { id: true, studentProfileId: true, status: true, assessment: { select: { courseUnitId: true, assessmentDate: true, courseUnit: { select: { departmentId: true } } } } },
		});
	} else {
		source = await db.attendanceAttempt.findUnique({
			where: { id: input.attendanceAttemptId },
			select: { id: true, studentProfileId: true, outcome: true, session: { select: { id: true, courseUnitId: true, lecturerProfileId: true, startsAt: true, courseUnit: { select: { departmentId: true } } } } },
		});
	}
	if (!source) throw new AppError(404, "Attendance source not found");
	const courseUnitId = source.session?.courseUnitId ?? source.assessment?.courseUnitId;
	const departmentId = source.session?.courseUnit?.departmentId ?? source.assessment?.courseUnit?.departmentId;
	if (!courseUnitId || !departmentId) throw new AppError(409, "Attendance source has no valid course unit");
	if (input.studentProfileId && source.studentProfileId !== input.studentProfileId) throw new AppError(404, "Attendance source not found");
	const academicYear = academicYearForDate(source.session?.startsAt ?? source.assessment?.assessmentDate ?? new Date());
	let assignedLecturerProfileId = source.session?.lecturerProfileId ?? null;
	if (assignedLecturerProfileId) {
		const validSessionLecturer = await db.lecturerProfile.findFirst({
			where: { id: assignedLecturerProfileId, unitAssignments: { some: { courseUnitId, academicYear } }, user: { isActive: true, roles: { some: { role: { name: "lecturer" } } } } },
			select: { id: true },
		});
		if (!validSessionLecturer) assignedLecturerProfileId = null;
	}
	if (!assignedLecturerProfileId) {
		const assignments = await db.courseUnitLecturer.findMany({
			where: {
				courseUnitId,
				academicYear,
				lecturer: { user: { isActive: true, roles: { some: { role: { name: "lecturer" } } } } },
			},
			orderBy: { lecturerProfileId: "asc" },
			select: { lecturerProfileId: true },
			take: 2,
		});
		if (assignments.length > 1) throw new AppError(409, "Attendance source has multiple assigned lecturers and no designated reviewer");
		assignedLecturerProfileId = assignments[0]?.lecturerProfileId ?? null;
	}
	if (!assignedLecturerProfileId) throw new AppError(409, "No responsible lecturer is assigned to this attendance source");
	return { sourceType, source, courseUnitId, departmentId, academicYear, assignedLecturerProfileId };
}
