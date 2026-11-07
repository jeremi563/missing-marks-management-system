import test from "node:test";
import assert from "node:assert/strict";

const { createStudentAttendanceDiscrepancy, respondToStudentAttendanceDiscrepancy } = await import("../src/modules/student/student.service.js");
const { createLecturerAttendanceDiscrepancy, reviewStudentAttendanceDiscrepancy, respondToLecturerAttendanceDiscrepancy } = await import("../src/modules/lecturer/lecturer.service.js");

const ids = { studentUser: "student-user", lecturerUser: "lecturer-user", student: "student-1", lecturer: "lecturer-1", record: "record-1", discrepancy: "discrepancy-1", unit: "unit-1", department: "department-1" };

function workflowDb({ sourceStudentId = ids.student, sessionLecturerId = ids.lecturer, callerLecturerId = ids.lecturer, assigned = true, assessmentSource = null, attemptSource = null, extraAssignments = null, raceResponses = false, discrepancy = {}, decisions = [], comments = [] } = {}) {
	const state = { creates: [], decisions: [], comments: [], audits: [], sourceUniqueViolations: 0, responseUniqueViolations: 0, item: { id: ids.discrepancy, studentProfileId: ids.student, attendanceRecordId: ids.record, assessmentAttendanceId: null, attendanceAttemptId: null, assignedLecturerProfileId: ids.lecturer, submittedByUserId: ids.studentUser, submitterType: "STUDENT", status: "PENDING_LECTURER_REVIEW", ...discrepancy } };
	const source = { id: ids.record, studentProfileId: sourceStudentId, status: "PRESENT", session: { id: "session-1", courseUnitId: ids.unit, lecturerProfileId: sessionLecturerId, courseUnit: { departmentId: ids.department } } };
	const activeStatuses = new Set(["PENDING_LECTURER_REVIEW", "PENDING_COD_REVIEW", "CLARIFICATION_REQUESTED", "CORRECTION_RECOMMENDED", "CORRECTION_AUTHORIZED"]);
	const tx = {
		studentProfile: { findUnique: async () => ({ id: ids.student }) },
		lecturerProfile: {
			findUnique: async () => ({ id: callerLecturerId }),
			findFirst: async ({ where }) => where.id === sessionLecturerId && assigned ? { id: sessionLecturerId } : null,
		},
		attendanceRecord: { findUnique: async () => source },
		assessmentAttendance: { findUnique: async () => assessmentSource },
		attendanceAttempt: { findUnique: async () => attemptSource },
		courseUnitLecturer: {
			findUnique: async () => assigned ? { id: "assignment-1" } : null,
			findMany: async () => extraAssignments ?? (assigned ? [{ lecturerProfileId: callerLecturerId }] : []),
		},
		attendanceDiscrepancy: {
			create: async ({ data, select }) => {
				const sourceField = ["attendanceRecordId", "assessmentAttendanceId", "attendanceAttemptId"].find((field) => data[field]);
				const duplicate = state.creates.some((row) => row.studentProfileId === data.studentProfileId && row[sourceField] === data[sourceField] && activeStatuses.has(row.status));
				if (duplicate) { state.sourceUniqueViolations += 1; throw Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: `attendance_discrepancies_active_${sourceField}` } }); }
				const row = { id: `discrepancy-${state.creates.length + 1}`, ...data, createdAt: new Date() }; state.creates.push(row); return select ? Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]])) : row;
			},
			findFirst: async ({ where }) => where.submittedByUserId && state.item.submittedByUserId !== where.submittedByUserId ? null : { ...state.item, ...discrepancy },
			findUnique: async () => ({ ...state.item, ...discrepancy }),
			updateMany: async ({ where, data }) => {
				if (state.item.status !== where.status || (where.assignedLecturerProfileId && state.item.assignedLecturerProfileId !== where.assignedLecturerProfileId)) return { count: 0 };
				Object.assign(state.item, data); return { count: 1 };
			},
		},
		attendanceDiscrepancyDecision: {
			findFirst: async ({ where }) => decisions.filter((row) => row.discrepancyId === where.discrepancyId && row.decision === where.decision).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
			create: async ({ data }) => { const row = { id: `decision-${state.decisions.length + 1}`, ...data, createdAt: new Date() }; state.decisions.push(row); return row; },
		},
		attendanceDiscrepancyComment: {
			findFirst: async ({ where }) => {
				const existing = comments.concat(state.comments).find((row) => row.discrepancyId === where.discrepancyId && row.clarificationDecisionId === where.clarificationDecisionId && row.authorUserId === where.authorUserId) ?? null;
				if (raceResponses && where.clarificationDecisionId) {
					commentReadCount += 1;
					if (commentReadCount === 2) releaseCommentReads();
					await commentReadBarrier;
				}
				return existing;
			},
			create: async ({ data }) => {
				if (comments.concat(state.comments).some((row) => row.clarificationDecisionId === data.clarificationDecisionId && row.authorUserId === data.authorUserId)) {
					state.responseUniqueViolations += 1;
					throw Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: "attendance_discrepancy_comments_clarification_author_key" } });
				}
				const row = { id: `comment-${state.comments.length + 1}`, ...data, createdAt: new Date() }; state.comments.push(row); return row;
			},
		},
		auditLog: { create: async ({ data }) => { state.audits.push(data); return { id: `audit-${state.audits.length + 1}`, ...data }; } },
	};
	let commentReadCount = 0;
	let releaseCommentReads;
	const commentReadBarrier = new Promise((resolve) => { releaseCommentReads = resolve; });
	return { state, db: { ...tx, $transaction: (callback) => callback(tx) } };
}

test("student discrepancy submission checks source ownership and waits for assigned lecturer review", async () => {
	const f = workflowDb();
	const result = await createStudentAttendanceDiscrepancy(f.db, ids.studentUser, { attendanceRecordId: ids.record, description: "Register shows a different status" });
	assert.equal(result.status, "PENDING_LECTURER_REVIEW");
	assert.equal(f.state.creates[0].studentProfileId, ids.student);
	assert.equal(f.state.creates[0].assignedLecturerProfileId, ids.lecturer);
	assert.equal(f.state.creates[0].submittedByUserId, ids.studentUser);
});

test("student cannot submit a discrepancy for another student's source", async () => {
	const f = workflowDb({ sourceStudentId: "someone-else" });
	await assert.rejects(createStudentAttendanceDiscrepancy(f.db, ids.studentUser, { attendanceRecordId: ids.record, description: "Claim" }), { statusCode: 404 });
	assert.equal(f.state.creates.length, 0);
});

test("lecturer discrepancy submission requires course-unit assignment and goes to COD review", async () => {
	const f = workflowDb();
	const result = await createLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Register discrepancy" });
	assert.equal(result.status, "PENDING_COD_REVIEW");
	assert.equal(f.state.creates[0].submitterType, "LECTURER");
	const unassigned = workflowDb({ assigned: false });
	await assert.rejects(createLecturerAttendanceDiscrepancy(unassigned.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Claim" }));
});

test("only the responsible session lecturer may submit for that session", async () => {
	const responsible = workflowDb();
	const result = await createLecturerAttendanceDiscrepancy(responsible.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Register discrepancy" });
	assert.equal(result.status, "PENDING_COD_REVIEW");
	const anotherAssignedLecturer = workflowDb({ callerLecturerId: "lecturer-2", assigned: true });
	await assert.rejects(createLecturerAttendanceDiscrepancy(anotherAssignedLecturer.db, "lecturer-user-2", { attendanceRecordId: ids.record, description: "Claim" }), { statusCode: 404 });
	const unassignedLecturer = workflowDb({ callerLecturerId: "lecturer-3", assigned: false });
	await assert.rejects(createLecturerAttendanceDiscrepancy(unassignedLecturer.db, "lecturer-user-3", { attendanceRecordId: ids.record, description: "Claim" }));
});

test("assessment attendance uses its uniquely assigned responsible lecturer", async () => {
	const assessment = { id: "assessment-attendance-1", studentProfileId: ids.student, status: "PRESENT", assessment: { courseUnitId: ids.unit, courseUnit: { departmentId: ids.department } } };
	const permitted = workflowDb({ assessmentSource: assessment });
	const result = await createLecturerAttendanceDiscrepancy(permitted.db, ids.lecturerUser, { assessmentAttendanceId: assessment.id, description: "Assessment discrepancy" });
	assert.equal(result.status, "PENDING_COD_REVIEW");
	const unassigned = workflowDb({ assessmentSource: assessment, assigned: false });
	await assert.rejects(createLecturerAttendanceDiscrepancy(unassigned.db, ids.lecturerUser, { assessmentAttendanceId: assessment.id, description: "Claim" }));
});

test("active discrepancies are unique across repeated student and lecturer submissions", async () => {
	const studentDuplicate = workflowDb();
	await createStudentAttendanceDiscrepancy(studentDuplicate.db, ids.studentUser, { attendanceRecordId: ids.record, description: "First report" });
	await assert.rejects(createStudentAttendanceDiscrepancy(studentDuplicate.db, ids.studentUser, { attendanceRecordId: ids.record, description: "Second report" }), { statusCode: 409 });

	const lecturerDuplicate = workflowDb();
	await createLecturerAttendanceDiscrepancy(lecturerDuplicate.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "First report" });
	await assert.rejects(createLecturerAttendanceDiscrepancy(lecturerDuplicate.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Second report" }), { statusCode: 409 });
});

test("student and lecturer submissions share the same active source uniqueness rule", async () => {
	const studentFirst = workflowDb();
	await createStudentAttendanceDiscrepancy(studentFirst.db, ids.studentUser, { attendanceRecordId: ids.record, description: "Student report" });
	await assert.rejects(createLecturerAttendanceDiscrepancy(studentFirst.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Lecturer report" }), { statusCode: 409 });

	const lecturerFirst = workflowDb();
	await createLecturerAttendanceDiscrepancy(lecturerFirst.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Lecturer report" });
	await assert.rejects(createStudentAttendanceDiscrepancy(lecturerFirst.db, ids.studentUser, { attendanceRecordId: ids.record, description: "Student report" }), { statusCode: 409 });
});

test("active uniqueness covers assessment and attempt sources without conflating source types", async () => {
	const assessment = { id: ids.record, studentProfileId: ids.student, status: "PRESENT", assessment: { courseUnitId: ids.unit, courseUnit: { departmentId: ids.department } } };
	const assessmentDb = workflowDb({ assessmentSource: assessment });
	await createStudentAttendanceDiscrepancy(assessmentDb.db, ids.studentUser, { assessmentAttendanceId: ids.record, description: "Assessment report" });
	await assert.rejects(createLecturerAttendanceDiscrepancy(assessmentDb.db, ids.lecturerUser, { assessmentAttendanceId: ids.record, description: "Duplicate assessment report" }), { statusCode: 409 });

	const attempt = { id: ids.record, studentProfileId: ids.student, outcome: "REJECTED", session: { id: "session-1", courseUnitId: ids.unit, lecturerProfileId: ids.lecturer, courseUnit: { departmentId: ids.department } } };
	const attemptDb = workflowDb({ attemptSource: attempt });
	await createStudentAttendanceDiscrepancy(attemptDb.db, ids.studentUser, { attendanceAttemptId: ids.record, description: "Attempt report" });
	await assert.rejects(createLecturerAttendanceDiscrepancy(attemptDb.db, ids.lecturerUser, { attendanceAttemptId: ids.record, description: "Duplicate attempt report" }), { statusCode: 409 });

	const distinctTypes = workflowDb({ assessmentSource: assessment });
	await createStudentAttendanceDiscrepancy(distinctTypes.db, ids.studentUser, { attendanceRecordId: ids.record, description: "Session report" });
	const secondSourceType = await createLecturerAttendanceDiscrepancy(distinctTypes.db, ids.lecturerUser, { assessmentAttendanceId: ids.record, description: "Assessment report" });
	assert.equal(secondSourceType.status, "PENDING_COD_REVIEW");
});

test("a new discrepancy is allowed after the previous one becomes terminal", async () => {
	const f = workflowDb();
	await createStudentAttendanceDiscrepancy(f.db, ids.studentUser, { attendanceRecordId: ids.record, description: "First report" });
	f.state.creates[0].status = "CORRECTION_APPLIED";
	const result = await createLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Later report" });
	assert.equal(result.status, "PENDING_COD_REVIEW");
	assert.equal(f.state.creates.length, 2);
});

test("concurrent student and lecturer submissions cannot create duplicate active rows", async () => {
	const f = workflowDb();
	const results = await Promise.allSettled([
		createStudentAttendanceDiscrepancy(f.db, ids.studentUser, { attendanceRecordId: ids.record, description: "Student report" }),
		createLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, { attendanceRecordId: ids.record, description: "Lecturer report" }),
	]);
	assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
	assert.equal(results.filter(({ status, reason }) => status === "rejected" && reason?.statusCode === 409).length, 1);
	assert.equal(f.state.creates.length, 1);
	assert.equal(f.state.sourceUniqueViolations, 1);
});

test("assigned lecturer can forward a student discrepancy to COD", async () => {
	const f = workflowDb();
	const result = await reviewStudentAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, { decision: "FORWARD_TO_COD", explanation: "Source checked" });
	assert.equal(result.status, "PENDING_COD_REVIEW");
	assert.equal(f.state.item.lecturerReviewedByProfileId, ids.lecturer);
	assert.equal(f.state.decisions[0].decision, "LECTURER_FORWARD");
});

test("assigned lecturer can reject with an explanation and cannot review another lecturer's item", async () => {
	const f = workflowDb();
	const result = await reviewStudentAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, { decision: "REJECT", explanation: "Evidence does not match" });
	assert.equal(result.status, "LECTURER_REJECTED");
	assert.equal(f.state.item.resolution, "Evidence does not match");
	const other = workflowDb({ discrepancy: { assignedLecturerProfileId: "other-lecturer" } });
	await assert.rejects(reviewStudentAttendanceDiscrepancy(other.db, ids.lecturerUser, ids.discrepancy, { decision: "FORWARD_TO_COD", explanation: "Review" }), { statusCode: 404 });
});

test("student clarification response is bound to the latest request", async () => {
	const requestOld = { id: "clarification-old", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-01T00:00:00Z") };
	const requestNew = { id: "clarification-new", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-02T00:00:00Z") };
	const oldResponse = { discrepancyId: ids.discrepancy, clarificationDecisionId: requestOld.id, authorUserId: ids.studentUser };
	const f = workflowDb({ discrepancy: { status: "CLARIFICATION_REQUESTED" }, decisions: [requestOld, requestNew], comments: [oldResponse] });
	const result = await respondToStudentAttendanceDiscrepancy(f.db, ids.studentUser, ids.discrepancy, "New evidence");
	assert.equal(result.clarificationDecisionId, requestNew.id);
	assert.equal(f.state.comments[0].authorUserId, ids.studentUser);
});

test("wrong reporter cannot answer a student's clarification", async () => {
	const f = workflowDb({ discrepancy: { status: "CLARIFICATION_REQUESTED", submittedByUserId: "other-user" }, decisions: [{ id: "clarification-1", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date() }] });
	await assert.rejects(respondToStudentAttendanceDiscrepancy(f.db, ids.studentUser, ids.discrepancy, "Response"), { statusCode: 404 });
});

test("student may answer one response per clarification decision, then answer a later request", async () => {
	const first = { id: "clarification-1", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-01T00:00:00Z") };
	const second = { id: "clarification-2", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-02T00:00:00Z") };
	const f = workflowDb({ discrepancy: { status: "CLARIFICATION_REQUESTED" }, decisions: [first] });
	await respondToStudentAttendanceDiscrepancy(f.db, ids.studentUser, ids.discrepancy, "First response");
	await assert.rejects(respondToStudentAttendanceDiscrepancy(f.db, ids.studentUser, ids.discrepancy, "Duplicate"), { statusCode: 409 });
	f.db.attendanceDiscrepancyDecision.findFirst = async ({ where }) => [first, second].filter((row) => row.discrepancyId === where.discrepancyId && row.decision === where.decision).at(-1);
	const later = await respondToStudentAttendanceDiscrepancy(f.db, ids.studentUser, ids.discrepancy, "Second response");
	assert.equal(later.clarificationDecisionId, second.id);
});

test("concurrent student clarification responses create only one row", async () => {
	const f = workflowDb({ raceResponses: true, discrepancy: { status: "CLARIFICATION_REQUESTED" }, decisions: [{ id: "clarification-1", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date() }] });
	const results = await Promise.allSettled([
		respondToStudentAttendanceDiscrepancy(f.db, ids.studentUser, ids.discrepancy, "First"),
		respondToStudentAttendanceDiscrepancy(f.db, ids.studentUser, ids.discrepancy, "Second"),
	]);
	assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
	assert.equal(results.filter(({ status, reason }) => status === "rejected" && reason?.statusCode === 409).length, 1);
	assert.equal(f.state.comments.length, 1);
	assert.equal(f.state.responseUniqueViolations, 1);
});

test("lecturer reporter can answer the latest clarification and stale responses do not satisfy it", async () => {
	const old = { id: "clarification-old", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-01T00:00:00Z") };
	const latest = { id: "clarification-latest", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-02T00:00:00Z") };
	const f = workflowDb({ discrepancy: { status: "CLARIFICATION_REQUESTED", submittedByUserId: ids.lecturerUser, submitterType: "LECTURER" }, decisions: [old, latest], comments: [{ discrepancyId: ids.discrepancy, clarificationDecisionId: old.id, authorUserId: ids.lecturerUser }] });
	const result = await respondToLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, "Clarified");
	assert.equal(result.clarificationDecisionId, latest.id);
});

test("a lecturer cannot respond on behalf of a different original reporter", async () => {
	const f = workflowDb({ discrepancy: { status: "CLARIFICATION_REQUESTED", submittedByUserId: "other-user", submitterType: "LECTURER" }, decisions: [{ id: "clarification-1", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date() }] });
	await assert.rejects(respondToLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, "Response"), { statusCode: 404 });
});

test("lecturer may answer one response per clarification decision, then answer a later request", async () => {
	const first = { id: "clarification-1", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-01T00:00:00Z") };
	const second = { id: "clarification-2", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date("2026-01-02T00:00:00Z") };
	const f = workflowDb({ discrepancy: { status: "CLARIFICATION_REQUESTED", submittedByUserId: ids.lecturerUser, submitterType: "LECTURER" }, decisions: [first] });
	await respondToLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, "First response");
	await assert.rejects(respondToLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, "Duplicate"), { statusCode: 409 });
	f.db.attendanceDiscrepancyDecision.findFirst = async ({ where }) => [first, second].filter((row) => row.discrepancyId === where.discrepancyId && row.decision === where.decision).at(-1);
	const later = await respondToLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, "Second response");
	assert.equal(later.clarificationDecisionId, second.id);
});

test("concurrent lecturer clarification responses create only one row", async () => {
	const f = workflowDb({ raceResponses: true, discrepancy: { status: "CLARIFICATION_REQUESTED", submittedByUserId: ids.lecturerUser, submitterType: "LECTURER" }, decisions: [{ id: "clarification-1", discrepancyId: ids.discrepancy, decision: "REQUEST_CLARIFICATION", createdAt: new Date() }] });
	const results = await Promise.allSettled([
		respondToLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, "First"),
		respondToLecturerAttendanceDiscrepancy(f.db, ids.lecturerUser, ids.discrepancy, "Second"),
	]);
	assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
	assert.equal(results.filter(({ status, reason }) => status === "rejected" && reason?.statusCode === 409).length, 1);
	assert.equal(f.state.comments.length, 1);
	assert.equal(f.state.responseUniqueViolations, 1);
});
