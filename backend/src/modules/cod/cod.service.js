import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";
import { recordAuditEvent } from "../../shared/services/audit.service.js";

async function getAuthorizedDepartmentIds(db, userId) {
  const memberships = await db.departmentMembership.findMany({
    where: { userId },
    select: { departmentId: true },
  });
  const departmentIds = memberships.map(({ departmentId }) => departmentId);
  if (!departmentIds.length) return [];
  const activeCod = await db.user.findFirst({
    where: { id: userId, isActive: true, roles: { some: { role: { name: "cod" } } } },
    select: { id: true },
  });
  if (!activeCod) return [];
  const designated = await db.department.findMany({
    where: { id: { in: departmentIds }, designatedCodUserId: userId },
    select: { id: true },
  });
  return designated.map(({ id }) => id);
}

async function getAuthorizedReport(db, userId, reportId) {
  const report = await db.missingMarkReport.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, courseUnitId: true, courseUnit: { select: { departmentId: true } } },
  });
  if (!report) throw new AppError(404, "Missing-mark report not found");

  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  if (!departmentIds.includes(report.courseUnit.departmentId)) {
    throw new AppError(403, "You do not have access to this department's reports");
  }
  return report;
}

export async function getCodReportDetails({ userId, reportId, db = prisma }) {
  const departmentIds = await getAuthorizedDepartmentIds(db, userId);
  const report = await db.missingMarkReport.findFirst({
    where: {
      id: reportId,
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
    const normalizedStatus = report.status?.toUpperCase();
    if (!["SUBMITTED", "PENDING"].includes(normalizedStatus)) {
      throw new AppError(409, "Only Submitted or PENDING reports may be assigned or reassigned");
    }
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
      where: { id: reportId, assignedLecturerProfileId: previousLecturerProfileId, status: report.status },
      data: { assignedLecturerProfileId: lecturerProfileId, ...(normalizedStatus === "SUBMITTED" ? { status: "PENDING" } : {}) },
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
    if (normalizedStatus === "SUBMITTED") {
      await tx.reportStatusHistory.create({ data: { reportId, actorUserId, previousStatus: report.status, newStatus: "PENDING", reason: reason?.trim() || "Report assigned to a lecturer." } });
      await recordAuditEvent({ prismaClient: tx, actorId: actorUserId, action: "REPORT_STATUS_CHANGED_ON_ASSIGNMENT", entityType: "MissingMarkReport", entityId: reportId, metadata: { previousStatus: report.status, newStatus: "PENDING" } });
    }
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

export async function listDepartmentReports({ userId, departmentId, status, page, limit, sort, db = prisma }) {
  const authorizedDepartmentIds = await getAuthorizedDepartmentIds(db, userId);
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
