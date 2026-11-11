import { prisma } from "../../config/database.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { AppError } from "../../shared/utils/app-error.js";

async function paginated(model, { where = {}, page, limit, orderBy = { createdAt: "desc" }, include, select }) {
	const [items, total] = await Promise.all([
		model.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, ...(include ? { include } : {}), ...(select ? { select } : {}) }),
		model.count({ where }),
	]);
	return { data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function mutate({ db, actorUserId, action, entityType, entityId, operation }) {
	return db.$transaction(async (tx) => {
		const result = await operation(tx);
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action, entityType, entityId: result.id, metadata: { id: result.id } });
		return result;
	});
}

export const listDepartments = ({ db = prisma, page, limit }) => paginated(db.department, { page, limit, orderBy: [{ name: "asc" }], include: { designatedCod: { select: { id: true, displayName: true, email: true } }, _count: { select: { courseUnits: true, members: true } } } });
export const listDepartmentMembers = ({ db = prisma, page, limit, departmentId, role }) => paginated(db.departmentMembership, { page, limit, where: { departmentId, ...(role ? { user: { roles: { some: { role: { name: role } } } } } : {}) }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, email: true, displayName: true, isActive: true, roles: { select: { role: { select: { name: true } } } }, lecturerProfile: { select: { id: true, staffNumber: true } } } }, department: { select: { id: true, name: true, code: true } } } });
export const listCourseUnits = ({ db = prisma, page, limit, departmentId }) => paginated(db.courseUnit, { page, limit, where: departmentId ? { departmentId } : {}, orderBy: [{ code: "asc" }], include: { department: { select: { id: true, name: true, code: true } }, _count: { select: { enrollments: true, lecturerMappings: true, assessments: true } } } });
export const listAcademicPeriods = ({ db = prisma, page, limit }) => paginated(db.academicPeriod, { page, limit, orderBy: [{ startsAt: "desc" }, { name: "asc" }], include: { _count: { select: { enrollments: true, reports: true } } } });
export const listEnrollments = ({ db = prisma, page, limit, studentProfileId, courseUnitId, academicPeriodId }) => paginated(db.unitEnrollment, { page, limit, where: { ...(studentProfileId ? { studentProfileId } : {}), ...(courseUnitId ? { courseUnitId } : {}), ...(academicPeriodId ? { academicPeriodId } : {}) }, orderBy: { createdAt: "desc" }, include: { student: { select: { id: true, studentNumber: true, user: { select: { id: true, displayName: true, email: true } } } }, courseUnit: { select: { id: true, code: true, name: true } }, academicPeriod: { select: { id: true, code: true, name: true } } } });
export const listMappings = ({ db = prisma, page, limit, courseUnitId, lecturerProfileId }) => paginated(db.courseUnitLecturer, { page, limit, where: { ...(courseUnitId ? { courseUnitId } : {}), ...(lecturerProfileId ? { lecturerProfileId } : {}) }, orderBy: { createdAt: "desc" }, include: { courseUnit: { select: { id: true, code: true, name: true } }, lecturer: { select: { id: true, staffNumber: true, user: { select: { id: true, displayName: true, email: true } } } } } });
export const listClassrooms = ({ db = prisma, page, limit }) => paginated(db.classroom, { page, limit, orderBy: [{ name: "asc" }] });
export const listAssessments = ({ db = prisma, page, limit, courseUnitId, type }) => paginated(db.assessment, { page, limit, where: { ...(courseUnitId ? { courseUnitId } : {}), ...(type ? { type } : {}) }, orderBy: [{ assessmentDate: "desc" }, { name: "asc" }], include: { courseUnit: { select: { id: true, code: true, name: true } }, _count: { select: { reports: true, sessions: true, attendanceRecords: true, catSubmissions: true } } } });
export const listAssessmentTypes = ({ db = prisma, page, limit, isActive }) => paginated(db.assessmentType, { page, limit, where: isActive === undefined ? {} : { isActive }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });

export const createDepartment = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_DEPARTMENT_CREATED", entityType: "Department", operation: (tx) => tx.department.create({ data }) });
export const updateDepartment = ({ db = prisma, actorUserId, id, ...data }) => mutate({ db, actorUserId, action: "ADMIN_DEPARTMENT_UPDATED", entityType: "Department", entityId: id, operation: async (tx) => { const current = await tx.department.findUnique({ where: { id } }); if (!current) throw new AppError(404, "Department not found"); return tx.department.update({ where: { id }, data }); } });
export const createCourseUnit = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_COURSE_UNIT_CREATED", entityType: "CourseUnit", operation: async (tx) => { if (!await tx.department.findUnique({ where: { id: data.departmentId }, select: { id: true } })) throw new AppError(422, "Department not found"); return tx.courseUnit.create({ data }); } });
export const updateCourseUnit = ({ db = prisma, actorUserId, id, ...data }) => mutate({ db, actorUserId, action: "ADMIN_COURSE_UNIT_UPDATED", entityType: "CourseUnit", entityId: id, operation: async (tx) => {
		const current = await tx.courseUnit.findUnique({ where: { id }, select: { id: true, departmentId: true, _count: { select: { enrollments: true, reports: true, attendanceSessions: true, assessments: true } } } });
		if (!current) throw new AppError(404, "Course unit not found");
		if (data.departmentId && !await tx.department.findUnique({ where: { id: data.departmentId }, select: { id: true } })) throw new AppError(422, "Department not found");
		if (data.departmentId && data.departmentId !== current.departmentId && Object.values(current._count).some((count) => count > 0)) throw new AppError(409, "A course unit with academic history cannot move departments");
		return tx.courseUnit.update({ where: { id }, data });
	} });
export const createAcademicPeriod = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_ACADEMIC_PERIOD_CREATED", entityType: "AcademicPeriod", operation: (tx) => tx.academicPeriod.create({ data }) });
export const updateAcademicPeriod = ({ db = prisma, actorUserId, id, ...data }) => mutate({ db, actorUserId, action: "ADMIN_ACADEMIC_PERIOD_UPDATED", entityType: "AcademicPeriod", entityId: id, operation: async (tx) => {
		const current = await tx.academicPeriod.findUnique({ where: { id }, select: { id: true, startsAt: true, endsAt: true } });
		if (!current) throw new AppError(404, "Academic period not found");
		const startsAt = data.startsAt ?? current.startsAt;
		const endsAt = data.endsAt ?? current.endsAt;
		if (startsAt && endsAt && endsAt <= startsAt) throw new AppError(422, "The end date must be later than the start date");
		return tx.academicPeriod.update({ where: { id }, data });
	} });
export const createEnrollment = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_ENROLLMENT_CREATED", entityType: "UnitEnrollment", operation: async (tx) => { const [student, unit, period] = await Promise.all([tx.studentProfile.findFirst({ where: { id: data.studentProfileId, user: { isActive: true, roles: { some: { role: { name: "student" } } } } }, select: { id: true } }), tx.courseUnit.findUnique({ where: { id: data.courseUnitId }, select: { id: true } }), tx.academicPeriod.findUnique({ where: { id: data.academicPeriodId }, select: { id: true } })]); if (!student || !unit || !period) throw new AppError(422, "Student, course unit, and academic period must exist; the student account must be active and have the student role"); return tx.unitEnrollment.create({ data }); } });
export const createMapping = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_LECTURER_MAPPING_CREATED", entityType: "CourseUnitLecturer", operation: async (tx) => { const [unit, lecturer] = await Promise.all([tx.courseUnit.findUnique({ where: { id: data.courseUnitId }, select: { id: true } }), tx.lecturerProfile.findFirst({ where: { id: data.lecturerProfileId, user: { isActive: true, roles: { some: { role: { name: "lecturer" } } } } }, select: { id: true } })]); if (!unit || !lecturer) throw new AppError(422, "Course unit and lecturer profile must exist; the lecturer account must be active and have the lecturer role"); return tx.courseUnitLecturer.create({ data }); } });
export const createClassroom = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_CLASSROOM_CREATED", entityType: "Classroom", operation: (tx) => tx.classroom.create({ data }) });
export const updateClassroom = ({ db = prisma, actorUserId, id, ...data }) => mutate({ db, actorUserId, action: "ADMIN_CLASSROOM_UPDATED", entityType: "Classroom", entityId: id, operation: async (tx) => { if (!await tx.classroom.findUnique({ where: { id }, select: { id: true } })) throw new AppError(404, "Classroom not found"); return tx.classroom.update({ where: { id }, data }); } });
export const createAssessment = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_ASSESSMENT_CREATED", entityType: "Assessment", operation: async (tx) => { if (!await tx.courseUnit.findUnique({ where: { id: data.courseUnitId }, select: { id: true } })) throw new AppError(422, "Course unit not found"); return tx.assessment.create({ data: { ...data, createdByUserId: actorUserId } }); } });
export const updateAssessment = ({ db = prisma, actorUserId, id, ...data }) => mutate({ db, actorUserId, action: "ADMIN_ASSESSMENT_UPDATED", entityType: "Assessment", entityId: id, operation: async (tx) => { if (!await tx.assessment.findUnique({ where: { id }, select: { id: true } })) throw new AppError(404, "Assessment not found"); return tx.assessment.update({ where: { id }, data }); } });
export const createAssessmentType = ({ db = prisma, actorUserId, ...data }) => mutate({ db, actorUserId, action: "ADMIN_ASSESSMENT_TYPE_CREATED", entityType: "AssessmentType", operation: (tx) => tx.assessmentType.create({ data }) });
export const updateAssessmentType = ({ db = prisma, actorUserId, id, ...data }) => mutate({ db, actorUserId, action: "ADMIN_ASSESSMENT_TYPE_UPDATED", entityType: "AssessmentType", entityId: id, operation: async (tx) => { if (!await tx.assessmentType.findUnique({ where: { id }, select: { id: true } })) throw new AppError(404, "Assessment type not found"); return tx.assessmentType.update({ where: { id }, data }); } });

export const addDepartmentMember = ({ db = prisma, actorUserId, departmentId, userId }) => mutate({ db, actorUserId, action: "ADMIN_DEPARTMENT_MEMBER_ADDED", entityType: "DepartmentMembership", operation: async (tx) => {
		if (!await tx.department.findUnique({ where: { id: departmentId }, select: { id: true } })) throw new AppError(404, "Department not found");
		const user = await tx.user.findFirst({ where: { id: userId, isActive: true, roles: { some: { role: { name: { in: ["lecturer", "cod", "administrator"] } } } } }, select: { id: true } });
		if (!user) throw new AppError(422, "Department members must be active lecturer, COD, or administrator accounts");
		return tx.departmentMembership.create({ data: { departmentId, userId }, select: { id: true, departmentId: true, userId: true, createdAt: true } });
	} });

export const removeDepartmentMember = ({ db = prisma, actorUserId, departmentId, userId }) => db.$transaction(async (tx) => {
		const department = await tx.department.findUnique({ where: { id: departmentId }, select: { id: true, designatedCodUserId: true } });
		if (!department) throw new AppError(404, "Department not found");
		if (department.designatedCodUserId === userId) throw new AppError(409, "Change the designated COD before removing that department membership");
		const membership = await tx.departmentMembership.findUnique({ where: { userId_departmentId: { userId, departmentId } }, select: { id: true } });
		if (!membership) throw new AppError(404, "Department membership not found");
		await tx.departmentMembership.delete({ where: { id: membership.id } });
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "ADMIN_DEPARTMENT_MEMBER_REMOVED", entityType: "DepartmentMembership", entityId: membership.id, metadata: { departmentId, userId } });
		return { id: membership.id, departmentId, userId };
});

async function remove({ db, actorUserId, id, model, action, entityType, message }) {
	return db.$transaction(async (tx) => {
		try { await tx[model].delete({ where: { id } }); } catch (error) { if (error.code === "P2025") throw new AppError(404, message); if (error.code === "P2003") throw new AppError(409, "This relationship is referenced by protected academic history"); throw error; }
		await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action, entityType, entityId: id, metadata: { id } });
		return { id };
	});
}

export const deleteEnrollment = ({ db = prisma, actorUserId, id }) => remove({ db, actorUserId, id, model: "unitEnrollment", action: "ADMIN_ENROLLMENT_DELETED", entityType: "UnitEnrollment", message: "Enrolment not found" });
export const deleteMapping = ({ db = prisma, actorUserId, id }) => remove({ db, actorUserId, id, model: "courseUnitLecturer", action: "ADMIN_LECTURER_MAPPING_DELETED", entityType: "CourseUnitLecturer", message: "Lecturer mapping not found" });