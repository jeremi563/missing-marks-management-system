import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";

async function getAuthorizedDepartmentIds(db, userId) {
  const memberships = await db.departmentMembership.findMany({
    where: { userId },
    select: { departmentId: true },
  });
  return memberships.map(({ departmentId }) => departmentId);
}

async function getAuthorizedReport(db, userId, reportId) {
  const report = await db.missingMarkReport.findUnique({
    where: { id: reportId },
    select: { id: true, courseUnitId: true, courseUnit: { select: { departmentId: true } } },
  });
  if (!report) throw new AppError(404, "Missing-mark report not found");

  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.includes(report.courseUnit.departmentId)) {
    throw new AppError(403, "You do not have access to this department's reports");
  }
  return report;
}

export async function getCodReportDetails({ userId, reportId }) {
  const departmentIds = await getAuthorizedDepartmentIds(prisma, userId);
  const report = await prisma.missingMarkReport.findFirst({
    where: {
      id: reportId,
      courseUnit: { departmentId: { in: departmentIds } },
    },
    select: {
      id: true,
      reference: true,
      assessmentComponent: true,
      description: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      studentProfileId: true,
      courseUnitId: true,
      academicPeriodId: true,
      student: { select: { id: true, studentNumber: true, officialEmail: true } },
      courseUnit: { select: { id: true, code: true, name: true, departmentId: true } },
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
      assignedLecturer: {
        select: { id: true, user: { select: { displayName: true, email: true } } },
      },
    },
  });

  if (!report) {
    throw new AppError(404, "Missing-mark report not found");
  }

  const [enrollment, linkedAssessment] = await Promise.all([
    prisma.unitEnrollment.findUnique({
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
      ? prisma.assessment.findUnique({
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

  return {
    id: report.id,
    reference: report.reference,
    assessmentComponent: report.assessmentComponent,
    description: report.description,
    status: report.status,
    submittedAt: report.submittedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    student: report.student,
    courseUnit: report.courseUnit,
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

async function findEligibleLecturer(db, lecturerProfileId, courseUnitId) {
  return db.courseUnitLecturer.findFirst({
    where: {
      courseUnitId,
      lecturerProfileId,
      lecturer: {
        user: {
          isActive: true,
          roles: { some: { role: { name: "lecturer" } } },
        },
      },
    },
    select: {
      lecturer: {
        select: {
          id: true,
          staffNumber: true,
          user: { select: { id: true, displayName: true, email: true } },
        },
      },
    },
  });
}

export async function listEligibleLecturers({ userId, reportId }) {
  const report = await getAuthorizedReport(prisma, userId, reportId);
  const mappings = await prisma.courseUnitLecturer.findMany({
    where: {
      courseUnitId: report.courseUnitId,
      lecturer: {
        user: { isActive: true, roles: { some: { role: { name: "lecturer" } } } },
      },
    },
    select: {
      lecturer: {
        select: {
          id: true,
          staffNumber: true,
          user: { select: { id: true, displayName: true, email: true } },
        },
      },
    },
    orderBy: { lecturer: { user: { displayName: "asc" } } },
  });

  return mappings.map(({ lecturer }) => ({
    id: lecturer.id,
    staffNumber: lecturer.staffNumber,
    userId: lecturer.user.id,
    displayName: lecturer.user.displayName,
    email: lecturer.user.email,
  }));
}

export async function assignReportToLecturer({ actorUserId, reportId, lecturerProfileId, reason }) {
  return prisma.$transaction(async (tx) => {
    const report = await getAuthorizedReport(tx, actorUserId, reportId);
    const candidate = await findEligibleLecturer(tx, lecturerProfileId, report.courseUnitId);
    if (!candidate) {
      throw new AppError(400, "Selected lecturer is not eligible for this report's course unit");
    }

    const current = await tx.missingMarkReport.findUnique({
      where: { id: reportId },
      select: { assignedLecturerProfileId: true },
    });
    const previousLecturerProfileId = current.assignedLecturerProfileId;
    const update = await tx.missingMarkReport.updateMany({
      where: { id: reportId, assignedLecturerProfileId: previousLecturerProfileId },
      data: { assignedLecturerProfileId: lecturerProfileId },
    });
    if (update.count !== 1) {
      throw new AppError(409, "Report assignment changed; reload the report and try again");
    }

    const assignment = await tx.reportAssignment.create({
      data: {
        reportId,
        actorUserId,
        previousLecturerProfileId,
        newLecturerProfileId: lecturerProfileId,
        reason,
      },
    });
    await recordAuditEvent({
      prismaClient: tx,
      actorId: actorUserId,
      action: previousLecturerProfileId ? "REPORT_REASSIGNED" : "REPORT_ASSIGNED",
      entityType: "MissingMarkReport",
      entityId: reportId,
      metadata: {
        previousLecturerProfileId,
        newLecturerProfileId: lecturerProfileId,
        ...(reason === undefined ? {} : { reason }),
      },
    });

    return {
      reportId,
      assignedLecturerProfileId: lecturerProfileId,
      assignment,
    };
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

export async function listDepartmentReports({ userId, departmentId, status, page, limit, sort }) {
  const memberships = await prisma.departmentMembership.findMany({
    where: { userId },
    select: { departmentId: true },
  });

  const authorizedDepartmentIds = memberships.map(({ departmentId }) => departmentId);
  if (authorizedDepartmentIds.length === 0) {
    return { items: [], page, limit, total: 0, totalPages: 0 };
  }

  if (departmentId && !authorizedDepartmentIds.includes(departmentId)) {
    throw new AppError(403, "Department filter is not within your authorized departments");
  }

  const effectiveDepartmentIds = departmentId ? [departmentId] : authorizedDepartmentIds;

  const where = {
    courseUnit: {
      departmentId: { in: effectiveDepartmentIds },
    },
    ...(status ? { status } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.missingMarkReport.count({ where }),
    prisma.missingMarkReport.findMany({
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
