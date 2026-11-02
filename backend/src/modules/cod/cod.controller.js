import { sendSuccess } from "../../shared/utils/api-response.js";
import { listDepartmentReports } from "./cod.service.js";

export async function getCodReports(req, res, next) {
  try {
    const result = await listDepartmentReports({
      userId: req.user.id,
      departmentId: req.query.departmentId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort,
    });

    return sendSuccess(res, "Departmental reports retrieved successfully", result);
  } catch (error) {
    return next(error);
  }
}
