import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import {
	createCodCategory, decideCodAppeal, decideCodCase, getCodAppealById, getCodAppeals, getCodCategories,
	getCodCaseById, getCodCases, getOverdueAppeals, getOverdueCases, updateCodCategory,
} from "./feature5.controller.js";
import { appealIdParams, categoryCreateBody, categoryUpdateBody, decisionBody, itemIdParams, pageQuery, specialCaseIdParams, statusPageQuery } from "./feature5.validation.js";

export const feature5CodRoutes = Router();

feature5CodRoutes.get("/appeals/overdue", validate(pageQuery, "query"), getOverdueAppeals);
feature5CodRoutes.get("/special-cases/overdue", validate(pageQuery, "query"), getOverdueCases);
feature5CodRoutes.get("/appeals", validate(statusPageQuery, "query"), getCodAppeals);
feature5CodRoutes.get("/appeals/:appealId", validate(appealIdParams, "params"), getCodAppealById);
feature5CodRoutes.post("/appeals/:appealId/decision", validate(appealIdParams, "params"), validate(decisionBody), decideCodAppeal);
feature5CodRoutes.get("/special-cases", validate(statusPageQuery, "query"), getCodCases);
feature5CodRoutes.get("/special-cases/:caseId", validate(specialCaseIdParams, "params"), getCodCaseById);
feature5CodRoutes.post("/special-cases/:caseId/decision", validate(specialCaseIdParams, "params"), validate(decisionBody), decideCodCase);
feature5CodRoutes.get("/special-case-categories", getCodCategories);
feature5CodRoutes.post("/special-case-categories", validate(categoryCreateBody), createCodCategory);
feature5CodRoutes.patch("/special-case-categories/:id", validate(itemIdParams, "params"), validate(categoryUpdateBody), updateCodCategory);
