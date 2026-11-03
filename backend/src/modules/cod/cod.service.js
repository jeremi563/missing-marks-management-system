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
