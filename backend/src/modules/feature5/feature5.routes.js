import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
	createHoliday, deleteHoliday, getActiveCategories, getHolidayCalendar, updateHoliday, setDepartmentCod,
} from "./feature5.controller.js";
import { departmentIdParams, designationBody, holidayCreateBody, holidayIdParams, holidayQuery, holidayUpdateBody } from "./feature5.validation.js";
import { sensitiveOperationRateLimit } from "../../middleware/rate-limit.js";

export const feature5Routes = Router();
feature5Routes.get("/public-holidays", validate(holidayQuery, "query"), getHolidayCalendar);
feature5Routes.get("/special-case-categories", getActiveCategories);
feature5Routes.patch("/admin/departments/:departmentId/designated-cod", authenticate, authorize("administrator"), sensitiveOperationRateLimit, validate(departmentIdParams, "params"), validate(designationBody), setDepartmentCod);
feature5Routes.post("/admin/public-holidays", authenticate, authorize("administrator"), sensitiveOperationRateLimit, validate(holidayCreateBody), createHoliday);
feature5Routes.patch("/admin/public-holidays/:id", authenticate, authorize("administrator"), sensitiveOperationRateLimit, validate(holidayIdParams, "params"), validate(holidayUpdateBody), updateHoliday);
feature5Routes.delete("/admin/public-holidays/:id", authenticate, authorize("administrator"), sensitiveOperationRateLimit, validate(holidayIdParams, "params"), deleteHoliday);
