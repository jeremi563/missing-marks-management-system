import { z } from "zod";

const uuid = z.string().uuid();
const markValue = z.number().finite().int().min(0, "Marks cannot be negative");

export const assessmentMarkParams = z.object({ assessmentId: uuid }).strict();
export const correctionParams = z.object({ correctionId: uuid }).strict();
export const reportCorrectionParams = z.object({ reportId: uuid }).strict();

export const markOptionsQuery = z.object({}).strict();
export const assessmentRosterQuery = z.object({ academicPeriodId: uuid }).strict();
export const submitMarksBody = z.object({
	academicPeriodId: uuid,
	marks: z.array(z.object({
		studentProfileId: uuid,
		value: markValue,
	}).strict()).min(1).max(1000),
}).strict().superRefine(({ marks }, context) => {
	const ids = marks.map(({ studentProfileId }) => studentProfileId);
	if (new Set(ids).size !== ids.length) {
		context.addIssue({ code: "custom", path: ["marks"], message: "A student may appear only once in a submission" });
	}
});

export const codCorrectionsQuery = z.object({
	departmentId: uuid.optional(),
	status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).default("PENDING_REVIEW"),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const correctionDecisionBody = z.object({
	decision: z.enum(["APPROVE", "REJECT"]),
	comments: z.string().trim().max(2000).optional(),
}).strict().superRefine(({ decision, comments }, context) => {
	if (decision === "REJECT" && !comments?.length) {
		context.addIssue({ code: "custom", path: ["comments"], message: "Review comments are required to reject a correction" });
	}
});

export const studentMarksQuery = z.object({ academicPeriodId: uuid.optional() }).strict();
