import { AppError } from "../../shared/utils/app-error.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { getDesignatedCodDepartmentIds, isActiveCodDepartmentMember } from "../../shared/services/designated-cod-authorization.service.js";
import { academicYearForDate, academicYearForPeriod } from "../../shared/utils/academic-year.js";
import { parseStudentRegistrationNumber } from "../../shared/utils/registration-number.js";

function isEnrollmentOpen(period, now) {
	return Boolean(period.enrollmentOpensAt && period.enrollmentClosesAt)
		&& new Date(period.enrollmentOpensAt) <= now
		&& now <= new Date(period.enrollmentClosesAt);
}

async function findStudent(db, userId) {
	const student = await db.studentProfile.findUnique({
		where: { userId },
		select: { id: true, studentNumber: true },
	});
	if (!student) throw new AppError(404, "Student profile not found");
	if (!parseStudentRegistrationNumber(student.studentNumber)) {
		throw new AppError(422, "Ask an administrator to update your student number to the new department/course format before continuing");
	}
	return student;
}

export async function listStudentEnrollmentOptions(db, userId, now = new Date()) {
	const student = await findStudent(db, userId);
	const registration = parseStudentRegistrationNumber(student.studentNumber);
	const [academicPeriods, enrollments, requests] = await Promise.all([
		db.academicPeriod.findMany({
			orderBy: [{ startsAt: "desc" }, { name: "asc" }],
			select: { id: true, code: true, name: true, startsAt: true, enrollmentOpensAt: true, enrollmentClosesAt: true },
		}),
		db.unitEnrollment.findMany({
			where: {
				studentProfileId: student.id,
				courseUnit: {
					department: { initials: registration.departmentInitials },
					course: { is: { code: registration.courseCode } },
				},
			},
			select: {
				courseUnitId: true,
				academicPeriodId: true,
				academicPeriod: { select: { name: true, code: true, startsAt: true } },
			},
		}),
		db.studentEnrollmentRequest.findMany({
			where: {
				studentProfileId: student.id,
				courseUnit: {
					department: { initials: registration.departmentInitials },
					course: { is: { code: registration.courseCode } },
				},
			},
			orderBy: { updatedAt: "desc" },
			select: {
				id: true,
				courseUnitId: true,
				academicPeriodId: true,
				status: true,
				createdAt: true,
				updatedAt: true,
				decisionNote: true,
				courseUnit: { select: { code: true, name: true } },
				academicPeriod: { select: { code: true, name: true } },
				reviewedBy: { select: { displayName: true } },
			},
		}),
	]);
	const openPeriods = academicPeriods.filter((period) => isEnrollmentOpen(period, now));
	const lecturerYears = [...new Set([
		academicYearForDate(now),
		...openPeriods.map(academicYearForPeriod),
		...enrollments.map(({ academicPeriod }) => academicYearForPeriod(academicPeriod)),
	].filter(Boolean))];
	const courseUnits = await db.courseUnit.findMany({
		where: {
			department: { initials: registration.departmentInitials },
			course: { is: { code: registration.courseCode } },
		},
		orderBy: [{ code: "asc" }],
		select: {
			id: true,
			code: true,
			name: true,
			department: { select: { id: true, name: true, initials: true } },
			lecturerMappings: {
				where: {
					academicYear: { in: lecturerYears },
					lecturer: { user: { isActive: true, approvalStatus: "APPROVED" } },
				},
				select: { lecturer: { select: { user: { select: { id: true, displayName: true } } } } },
			},
		},
	});

	return {
		courses: courseUnits.map(({ lecturerMappings, ...course }) => ({
			...course,
			lecturers: lecturerMappings.map(({ lecturer }) => lecturer.user).filter(Boolean),
		})),
		academicPeriods: openPeriods,
		enrollments,
		requests,
	};
}

export async function createStudentEnrollmentRequests(db, userId, { courseUnitIds, academicPeriodId }, now = new Date()) {
	const uniqueCourseUnitIds = [...new Set(courseUnitIds)];
	if (uniqueCourseUnitIds.length !== courseUnitIds.length) throw new AppError(400, "A course unit can only be selected once");

	return db.$transaction(async (tx) => {
		const student = await findStudent(tx, userId);
		const registration = parseStudentRegistrationNumber(student.studentNumber);
		const period = await tx.academicPeriod.findUnique({
			where: { id: academicPeriodId },
			select: { id: true, name: true, code: true, startsAt: true, enrollmentOpensAt: true, enrollmentClosesAt: true },
		});
		if (!period || !isEnrollmentOpen(period, now)) throw new AppError(422, "Enrollment is not open for the selected academic period");
		const academicYear = academicYearForPeriod(period);
		if (!academicYear) throw new AppError(422, "The selected academic period does not have a recognizable academic year");

		const courseUnits = await tx.courseUnit.findMany({
			where: {
				id: { in: uniqueCourseUnitIds },
				department: { initials: registration.departmentInitials },
				course: { is: { code: registration.courseCode } },
				lecturerMappings: { some: { academicYear, lecturer: { user: { isActive: true, approvalStatus: "APPROVED" } } } },
			},
			select: {
				id: true,
				code: true,
				department: {
					select: {
						id: true,
						name: true,
						designatedCodUserId: true,
						members: {
							where: {
								user: {
									isActive: true,
									roles: { some: { role: { name: "cod" } } },
								},
							},
							select: { userId: true },
						},
					},
				},
				lecturerMappings: {
					where: { academicYear, lecturer: { user: { isActive: true, approvalStatus: "APPROVED" } } },
					select: { lecturer: { select: { userId: true } } },
				},
			},
		});
		if (courseUnits.length !== uniqueCourseUnitIds.length) {
			throw new AppError(422, "Select only department course units that have an active, approved lecturer assigned");
		}

		const [enrollments, existingRequests] = await Promise.all([
			tx.unitEnrollment.findMany({
				where: { studentProfileId: student.id, academicPeriodId, courseUnitId: { in: uniqueCourseUnitIds } },
				select: { courseUnitId: true },
			}),
			tx.studentEnrollmentRequest.findMany({
				where: { studentProfileId: student.id, academicPeriodId, courseUnitId: { in: uniqueCourseUnitIds } },
				select: { id: true, courseUnitId: true, status: true },
			}),
		]);
		if (enrollments.length) throw new AppError(409, "You are already enrolled in one or more selected course units for this period");
		if (existingRequests.some(({ status }) => status === "PENDING" || status === "APPROVED")) {
			throw new AppError(409, "A request for one or more selected course units is already pending or approved");
		}

		const createdRequests = [];
		for (const course of courseUnits) {
			const previous = existingRequests.find(({ courseUnitId }) => courseUnitId === course.id);
			const request = previous
				? await tx.studentEnrollmentRequest.update({
					where: { id: previous.id },
					data: { status: "PENDING", reviewedByUserId: null, reviewedAt: null, decisionNote: null },
					select: { id: true, courseUnitId: true, academicPeriodId: true, status: true, createdAt: true },
				})
				: await tx.studentEnrollmentRequest.create({
					data: { studentProfileId: student.id, courseUnitId: course.id, academicPeriodId },
					select: { id: true, courseUnitId: true, academicPeriodId: true, status: true, createdAt: true },
				});
			createdRequests.push(request);

			const recipients = new Set(course.lecturerMappings.map(({ lecturer }) => lecturer.userId));
			if (course.department.designatedCodUserId
				&& course.department.members.some(({ userId: memberUserId }) => memberUserId === course.department.designatedCodUserId)
				&& await isActiveCodDepartmentMember(tx, course.department.designatedCodUserId, course.department.id)) {
				recipients.add(course.department.designatedCodUserId);
			}
			for (const recipientUserId of recipients) {
				await tx.notification.create({
					data: {
						userId: recipientUserId,
						title: "Course enrollment request",
						message: `A student requested enrollment in ${course.code} for ${period.name}.`,
					},
				});
			}
			await recordAuditEvent({
				prismaClient: tx,
				actorId: userId,
				action: "STUDENT_ENROLLMENT_REQUEST_SUBMITTED",
				entityType: "StudentEnrollmentRequest",
				entityId: request.id,
				metadata: { courseUnitId: course.id, academicPeriodId },
			});
		}
		return createdRequests;
	});
}

async function getReviewerScope(db, userId) {
	const [lecturer, codDepartmentIds] = await Promise.all([
		db.lecturerProfile.findFirst({
			where: {
				userId,
				user: { isActive: true, approvalStatus: "APPROVED", roles: { some: { role: { name: "lecturer" } } } },
			},
			select: { id: true, unitAssignments: { select: { courseUnitId: true, academicYear: true } } },
		}),
		getDesignatedCodDepartmentIds(db, userId),
	]);
	return {
		assignments: lecturer?.unitAssignments.filter(({ academicYear }) => academicYear) ?? [],
		departmentIds: codDepartmentIds,
	};
}

function reviewerWhere(scope, status, periods) {
	const OR = [];
	for (const assignment of scope.assignments) {
		const academicPeriodIds = periods.filter((period) => academicYearForPeriod(period) === assignment.academicYear).map(({ id }) => id);
		if (academicPeriodIds.length) {
			OR.push({ courseUnitId: assignment.courseUnitId, academicPeriodId: { in: academicPeriodIds } });
		}
	}
	if (scope.departmentIds.length) OR.push({ courseUnit: { departmentId: { in: scope.departmentIds } } });
	return { ...(status ? { status } : {}), OR };
}

export async function listEnrollmentRequestsForReviewer(db, userId, status) {
	const [scope, periods] = await Promise.all([
		getReviewerScope(db, userId),
		db.academicPeriod.findMany({ select: { id: true, name: true, code: true, startsAt: true } }),
	]);
	if (!scope.assignments.length && !scope.departmentIds.length) throw new AppError(403, "You are not assigned to review course enrollment requests");
	return db.studentEnrollmentRequest.findMany({
		where: reviewerWhere(scope, status, periods),
		orderBy: [{ status: "asc" }, { createdAt: "asc" }],
		take: 200,
		select: {
			id: true,
			status: true,
			createdAt: true,
			academicPeriod: { select: { id: true, code: true, name: true } },
			courseUnit: { select: { id: true, code: true, name: true, department: { select: { id: true, name: true } } } },
			student: { select: { id: true, studentNumber: true, user: { select: { displayName: true, email: true } } } },
		},
	});
}

export async function decideEnrollmentRequests(db, userId, { requestIds, decision }) {
	const ids = [...new Set(requestIds)];
	if (ids.length !== requestIds.length) throw new AppError(400, "A request can only be selected once");
	const outcome = decision === "APPROVE" ? "APPROVED" : "REJECTED";
	try {
		return await db.$transaction(async (tx) => {
			const scope = await getReviewerScope(tx, userId);
			const periods = await tx.academicPeriod.findMany({ select: { id: true, name: true, code: true, startsAt: true } });
			if (!scope.assignments.length && !scope.departmentIds.length) throw new AppError(403, "You are not assigned to review course enrollment requests");

			const requests = await tx.studentEnrollmentRequest.findMany({
				where: { id: { in: ids }, status: "PENDING" },
				select: {
					id: true,
					studentProfileId: true,
					courseUnitId: true,
					academicPeriodId: true,
					courseUnit: { select: { departmentId: true, code: true, department: { select: { name: true } } } },
					student: { select: { userId: true } },
					academicPeriod: { select: { name: true, code: true, startsAt: true } },
				},
			});
			if (requests.length !== ids.length) throw new AppError(409, "One or more selected requests are no longer pending");

			const canReview = (request) => scope.assignments.some((assignment) =>
				assignment.courseUnitId === request.courseUnitId
				&& assignment.academicYear === academicYearForPeriod(request.academicPeriod))
				|| scope.departmentIds.includes(request.courseUnit.departmentId);
			if (requests.some((request) => !canReview(request))) throw new AppError(403, "You may only decide requests for your assigned course units or designated departments");

			for (const request of requests) {
				if (outcome === "APPROVED") {
					await tx.unitEnrollment.create({
						data: {
							studentProfileId: request.studentProfileId,
							courseUnitId: request.courseUnitId,
							academicPeriodId: request.academicPeriodId,
						},
					});
				}
				const updated = await tx.studentEnrollmentRequest.updateMany({
					where: { id: request.id, status: "PENDING" },
					data: { status: outcome, reviewedByUserId: userId, reviewedAt: new Date() },
				});
				if (updated.count !== 1) throw new AppError(409, "One or more selected requests have already been decided");

				await recordAuditEvent({
					prismaClient: tx,
					actorId: userId,
					action: `STUDENT_ENROLLMENT_REQUEST_${outcome}`,
					entityType: "StudentEnrollmentRequest",
					entityId: request.id,
					metadata: { courseUnitId: request.courseUnitId, academicPeriodId: request.academicPeriodId },
				});
				await tx.notification.create({
					data: {
						userId: request.student.userId,
						title: outcome === "APPROVED" ? "Enrollment request approved" : "Enrollment request declined",
						message: `${request.courseUnit.code} for ${request.academicPeriod.name} was ${outcome === "APPROVED" ? "approved" : "declined"} by your department.`,
					},
				});
			}
			return { count: requests.length, status: outcome };
		});
	} catch (error) {
		if (error.code === "P2002") throw new AppError(409, "One or more students are already enrolled in a selected course unit");
		throw error;
	}
}
