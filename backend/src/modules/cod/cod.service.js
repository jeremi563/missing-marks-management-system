import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/app-error.js";

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
