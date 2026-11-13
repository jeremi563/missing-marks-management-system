import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";
import { getDesignatedCodDepartmentIds } from "../../shared/services/designated-cod-authorization.service.js";
import { academicYearForDate } from "../../shared/utils/academic-year.js";

export async function getAuthorizedDepartmentIds(db, userId) {
  return getDesignatedCodDepartmentIds(db, userId);
}

function paginated(items, total, page, limit) {
  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listCodDepartments({ userId, db = prisma }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.length) return [];
  return db.department.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

export async function listCodDepartmentCourseUnits({ userId, departmentId, page = 1, limit = 20, db = prisma, now = new Date() }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.length) return paginated([], 0, page, limit);
  if (departmentId && !departmentIds.includes(departmentId)) throw new AppError(404, "Department not found");

  const academicYear = academicYearForDate(now);
  const where = { departmentId: { in: departmentId ? [departmentId] : departmentIds }, courseId: { not: null } };
  const [total, items] = await Promise.all([
    db.courseUnit.count({ where }),
    db.courseUnit.findMany({
      where,
      orderBy: [{ department: { name: "asc" } }, { course: { code: "asc" } }, { code: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        code: true,
        name: true,
        department: { select: { id: true, name: true, code: true } },
        course: { select: { id: true, code: true, name: true } },
        lecturerMappings: {
          where: { academicYear },
          select: {
            id: true,
            lecturer: {
              select: {
                id: true,
                staffNumber: true,
                user: { select: { id: true, displayName: true, email: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  return paginated(items, total, page, limit);
}

export async function assignCodCourseUnitLecturer({ userId, courseUnitId, departmentId, lecturerProfileId, db = prisma, now = new Date() }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.includes(departmentId)) throw new AppError(404, "Department not found");
  const academicYear = academicYearForDate(now);

  return db.$transaction(async (tx) => {
    const courseUnit = await tx.courseUnit.findFirst({
      where: { id: courseUnitId, departmentId },
      select: { id: true, course: { select: { id: true } } },
    });
    if (!courseUnit?.course) throw new AppError(404, "Course unit not found in an administered course");

    const lecturer = await tx.lecturerProfile.findFirst({
      where: {
        id: lecturerProfileId,
        user: {
          isActive: true,
          approvalStatus: "APPROVED",
          roles: { some: { role: { name: "lecturer" } } },
          departmentMemberships: { some: { departmentId } },
        },
      },
      select: { id: true },
    });
    if (!lecturer) throw new AppError(422, "Select an active, approved lecturer from this department");

    const existingAssignment = await tx.courseUnitLecturer.findUnique({
      where: { courseUnitId_academicYear: { courseUnitId, academicYear } },
      select: { id: true },
    });
    if (existingAssignment) throw new AppError(409, `This course unit already has a lecturer assigned for ${academicYear}`);

    let mapping;
    try {
      mapping = await tx.courseUnitLecturer.create({
        data: { courseUnitId, lecturerProfileId, academicYear },
        select: {
          id: true,
          courseUnitId: true,
          lecturerProfileId: true,
          lecturer: {
            select: {
              staffNumber: true,
              user: { select: { displayName: true, email: true } },
            },
          },
        },
      });
    } catch (error) {
      if (error.code === "P2002") throw new AppError(409, `This course unit already has a lecturer assigned for ${academicYear}`);
      throw error;
    }
    await recordAuditEvent({
      prismaClient: tx,
      actorId: userId,
      action: "COD_COURSE_UNIT_LECTURER_ASSIGNED",
      entityType: "CourseUnitLecturer",
      entityId: mapping.id,
      metadata: { courseUnitId, lecturerProfileId, departmentId, academicYear },
    });
    return mapping;
  });
}

export async function listCodDepartmentStudents({ userId, departmentId, page = 1, limit = 20, db = prisma }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.length) return paginated([], 0, page, limit);
  if (!departmentIds.includes(departmentId)) throw new AppError(404, "Department not found");

  const department = await db.department.findFirst({
    where: { id: departmentId, designatedCodUserId: userId },
    select: { id: true, name: true, code: true, initials: true },
  });
  if (!department?.initials) return paginated([], 0, page, limit);

  const where = { studentNumber: { startsWith: department.initials } };
  const [total, students] = await Promise.all([
    db.studentProfile.count({ where }),
    db.studentProfile.findMany({
      where,
      orderBy: { studentNumber: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        studentNumber: true,
        officialEmail: true,
        user: { select: { displayName: true, email: true, isActive: true } },
      },
    }),
  ]);
  const items = students.map((student) => ({ ...student, department: { id: department.id, name: department.name, code: department.code } }));
  return paginated(items, total, page, limit);
}

export async function listCodDepartmentLecturers({ userId, departmentId, page = 1, limit = 20, db = prisma }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.includes(departmentId)) throw new AppError(404, "Department not found");

  const where = {
    departmentId,
    user: {
      isActive: true,
      approvalStatus: "APPROVED",
      roles: { some: { role: { name: "lecturer" } } },
    },
  };
  const [total, memberships] = await Promise.all([
    db.departmentMembership.count({ where }),
    db.departmentMembership.findMany({
      where,
      orderBy: { user: { displayName: "asc" } },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            lecturerProfile: { select: { id: true, staffNumber: true } },
            roles: { select: { role: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);
  return paginated(memberships.map(({ user }) => user), total, page, limit);
}

async function getAuthorizedReport(db, userId, reportId) {
  const report = await db.missingMarkReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      courseUnitId: true,
      courseUnit: { select: { departmentId: true } },
      academicPeriod: { select: { name: true, code: true, startsAt: true } },
    },
  });
  if (!report) throw new AppError(404, "Missing-mark report not found");
  if (report.status?.toUpperCase() !== "ESCALATED") throw new AppError(404, "Missing-mark report not found");

  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.includes(report.courseUnit.departmentId)) {
    throw new AppError(404, "Missing-mark report not found");
  }
  return report;
}

export async function getCodReportDetails({ userId, reportId, db = prisma }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  const report = await db.missingMarkReport.findFirst({
    where: {
      id: reportId,
      status: "ESCALATED",
      courseUnit: { departmentId: { in: departmentIds } },
    },
    select: {
      id: true,
      reference: true,
      assessmentComponent: true,
      assessmentTypeOtherDescription: true,
      description: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      studentProfileId: true,
      courseUnitId: true,
      academicPeriodId: true,
      student: { select: { id: true, studentNumber: true, officialEmail: true } },
      courseUnit: {
        select: {
          id: true, code: true, name: true, departmentId: true,
          department: { select: { designatedCodUserId: true } },
        },
      },
      academicPeriod: { select: { id: true, code: true, name: true, startsAt: true, endsAt: true } },
      assessment: {
        select: {
          id: true,
          courseUnitId: true,
          code: true,
          name: true,
          type: true,
          assessmentDate: true,
          maximumMarks: true,
          attendanceRequired: true,
          submissionRequired: true,
        },
      },
      assessmentType: { select: { id: true, code: true, name: true } },
      assignedLecturer: {
        select: { id: true, user: { select: { displayName: true, email: true } } },
      },
      statusHistory: {
        select: {
          id: true,
          actorUserId: true,
          previousStatus: true,
          newStatus: true,
          reason: true,
          createdAt: true,
          actor: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      evidence: {
        select: {
          id: true,
          originalName: true,
          mediaType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!report) {
    throw new AppError(404, "Missing-mark report not found");
  }

  const [enrollment, linkedAssessment] = await Promise.all([
    db.unitEnrollment.findUnique({
      where: {
        studentProfileId_courseUnitId_academicPeriodId: {
          studentProfileId: report.studentProfileId,
          courseUnitId: report.courseUnitId,
          academicPeriodId: report.academicPeriodId,
        },
      },
      select: { id: true, createdAt: true },
    }),
    report.assessment && report.assessment.courseUnitId === report.courseUnitId
      ? db.assessment.findUnique({
        where: { id: report.assessment.id },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          assessmentDate: true,
          maximumMarks: true,
          attendanceRequired: true,
          submissionRequired: true,
          catSubmissions: {
            where: { studentProfileId: report.studentProfileId },
            select: { id: true, confirmedAt: true, verifiedAt: true, verifiedByLecturerId: true },
          },
          attendanceRecords: {
            where: { studentProfileId: report.studentProfileId },
            select: { id: true, status: true, recordedAt: true },
          },
        },
      })
      : Promise.resolve(null),
  ]);

  let lecturerDecisionReview = null;
  const wasEscalated = report.statusHistory.some((entry) => entry.newStatus?.toUpperCase() === "ESCALATED");
  if (wasEscalated) {
    const auditEvents = await db.auditLog.findMany({
        where: { entityType: "MissingMarkReport", entityId: report.id },
        select: {
          id: true,
          action: true,
          actorId: true,
          createdAt: true,
          actor: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    const lecturerDecision = report.statusHistory.find((entry) =>
      entry.previousStatus?.toUpperCase() === "PENDING" &&
      ["APPROVED", "REJECTED"].includes(entry.newStatus?.toUpperCase())
    );
    const escalation = report.statusHistory.find((entry) => entry.newStatus?.toUpperCase() === "ESCALATED");
    lecturerDecisionReview = {
      lecturerDecision: lecturerDecision ? {
        decision: lecturerDecision.newStatus.toUpperCase(),
        reason: lecturerDecision.reason,
        actor: lecturerDecision.actor,
        createdAt: lecturerDecision.createdAt,
      } : null,
      escalationReason: escalation?.reason ?? null,
      statusHistory: report.statusHistory,
      auditEvents,
      evidenceMetadata: report.courseUnit.department.designatedCodUserId === userId
        ? report.evidence.map(({ id, originalName, mediaType, sizeBytes, createdAt, uploadedBy }) => ({
          id, originalName, mediaType, sizeBytes, createdAt, uploadedBy,
        }))
        : [],
      evidenceNotice: "Metadata only; evidence file contents are not available through this API.",
    };
  }

  return {
    id: report.id,
    reference: report.reference,
    assessmentComponent: report.assessmentComponent,
    assessmentType: report.assessmentType,
    assessmentTypeOtherDescription: report.assessmentTypeOtherDescription,
    description: report.description,
    status: report.status,
    submittedAt: report.submittedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    student: report.student,
    courseUnit: {
      id: report.courseUnit.id,
      code: report.courseUnit.code,
      name: report.courseUnit.name,
      departmentId: report.courseUnit.departmentId,
    },
    academicPeriod: report.academicPeriod,
    assignedLecturer: report.assignedLecturer
      ? { id: report.assignedLecturer.id, displayName: report.assignedLecturer.user?.displayName ?? null, email: report.assignedLecturer.user?.email ?? null }
      : null,
    academicReview: {
      source: "Application records; not independently verified official university records",
      note: "A missing application record does not establish that an academic event did not occur.",
      enrollment,
      assessment: linkedAssessment ? {
        id: linkedAssessment.id,
        code: linkedAssessment.code,
        name: linkedAssessment.name,
        type: linkedAssessment.type,
        assessmentDate: linkedAssessment.assessmentDate,
        maximumMarks: linkedAssessment.maximumMarks,
        attendanceRequired: linkedAssessment.attendanceRequired,
        submissionRequired: linkedAssessment.submissionRequired,
        catSubmissions: linkedAssessment.catSubmissions,
        attendance: linkedAssessment.attendanceRecords,
      } : null,
    },
    ...(lecturerDecisionReview ? { lecturerDecisionReview } : {}),
  };
}

export async function listCodReportComments({ userId, reportId }) {
  const report = await getAuthorizedReport(prisma, userId, reportId);
  return prisma.reportComment.findMany({
    where: { reportId: report.id },
    select: {
      id: true,
      body: true,
      isStudentVisible: true,
      createdAt: true,
      author: { select: { id: true, displayName: true, roles: { select: { role: { select: { name: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
  }).then((comments) => comments.map((comment) => ({
    ...comment,
    author: { ...comment.author, roles: comment.author.roles.map(({ role }) => role.name) },
  })));
}

export async function addCodReportComment({ actorUserId, reportId, body }) {
  return prisma.$transaction(async (tx) => {
    const report = await getAuthorizedReport(tx, actorUserId, reportId);
    const comment = await tx.reportComment.create({
      data: { reportId: report.id, authorUserId: actorUserId, body: body.trim(), isStudentVisible: false },
      select: {
        id: true,
        reportId: true,
        body: true,
        isStudentVisible: true,
        createdAt: true,
        author: { select: { id: true, displayName: true } },
      },
    });
    await recordAuditEvent({
      prismaClient: tx,
      actorId: actorUserId,
      action: "COD_REPORT_COMMENT_ADDED",
      entityType: "MissingMarkReport",
      entityId: reportId,
      metadata: { commentId: comment.id },
    });
    return comment;
  });
}

export async function decideEscalatedReport({ actorUserId, reportId, decision, reason, db = prisma }) {
  return db.$transaction(async (tx) => {
    const report = await getAuthorizedReport(tx, actorUserId, reportId);
    if (report.status?.toUpperCase() !== "ESCALATED") {
      throw new AppError(409, "Only escalated reports can receive a COD final decision");
    }

    const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const update = await tx.missingMarkReport.updateMany({
      where: { id: report.id, status: report.status },
      data: { status: newStatus },
    });
    if (update.count !== 1) {
      throw new AppError(409, "Report state changed; reload the report before deciding");
    }

    const history = await tx.reportStatusHistory.create({
      data: {
        reportId: report.id,
        actorUserId,
        previousStatus: report.status,
        newStatus,
        reason,
      },
      select: { id: true, previousStatus: true, newStatus: true, reason: true, createdAt: true },
    });
    await recordAuditEvent({
      prismaClient: tx,
      actorId: actorUserId,
      action: "COD_REPORT_DECISION_RECORDED",
      entityType: "MissingMarkReport",
      entityId: report.id,
      metadata: { decision, status: newStatus },
    });

    return { reportId: report.id, status: newStatus, decision, history };
  });
}

function getOrderBy(sort) {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "status":
      return [{ status: "asc" }, { createdAt: "desc" }];
    case "studentNumber":
      return [{ student: { studentNumber: "asc" } }, { createdAt: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function listDepartmentReports({ userId, departmentId, page, limit, sort, db = prisma }) {
  const authorizedDepartmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (authorizedDepartmentIds.length === 0) {
    return { items: [], page, limit, total: 0, totalPages: 0 };
  }

  if (departmentId && !authorizedDepartmentIds.includes(departmentId)) {
    throw new AppError(403, "Department filter is not within your authorized departments");
  }

  const effectiveDepartmentIds = departmentId ? [departmentId] : authorizedDepartmentIds;

  const where = {
    status: "ESCALATED",
    courseUnit: {
      departmentId: { in: effectiveDepartmentIds },
    },
  };

  const [total, rows] = await Promise.all([
    db.missingMarkReport.count({ where }),
    db.missingMarkReport.findMany({
      where,
      include: {
        courseUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            departmentId: true,
          },
        },
        student: {
          select: {
            id: true,
            studentNumber: true,
            officialEmail: true,
          },
        },
        academicPeriod: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedLecturer: {
          select: {
            id: true,
            user: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: getOrderBy(sort),
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map((report) => ({
      id: report.id,
      reference: report.reference,
      assessmentComponent: report.assessmentComponent,
      description: report.description,
      status: report.status,
      submittedAt: report.submittedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      departmentId: report.courseUnit.departmentId,
      courseUnit: {
        id: report.courseUnit.id,
        code: report.courseUnit.code,
        name: report.courseUnit.name,
        departmentId: report.courseUnit.departmentId,
      },
      student: {
        id: report.student.id,
        studentNumber: report.student.studentNumber,
        officialEmail: report.student.officialEmail,
      },
      academicPeriod: {
        id: report.academicPeriod.id,
        name: report.academicPeriod.name,
      },
      assignedLecturer: report.assignedLecturer
        ? {
            id: report.assignedLecturer.id,
            displayName: report.assignedLecturer.user?.displayName ?? null,
            email: report.assignedLecturer.user?.email ?? null,
          }
        : null,
    })),
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
