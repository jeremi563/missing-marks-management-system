import { z } from "zod";

const uuid = z.string().uuid();

export const studentEnrollmentRequestBody = z.object({
	academicPeriodId: uuid,
	courseUnitIds: z.array(uuid).min(1).max(50),
}).strict().superRefine(({ courseUnitIds }, context) => {
	if (new Set(courseUnitIds).size !== courseUnitIds.length) {
		context.addIssue({ code: "custom", path: ["courseUnitIds"], message: "Course units must be unique." });
	}
});

export const enrollmentRequestListQuery = z.object({
	status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
}).strict();

export const enrollmentRequestDecisionBody = z.object({
	requestIds: z.array(uuid).min(1).max(200),
	decision: z.enum(["APPROVE", "REJECT"]),
}).strict().superRefine(({ requestIds }, context) => {
	if (new Set(requestIds).size !== requestIds.length) {
		context.addIssue({ code: "custom", path: ["requestIds"], message: "Requests must be unique." });
	}
});
