DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "attendance_discrepancies"
    WHERE "attendance_record_id" IS NOT NULL
      AND "status" IN ('PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'CLARIFICATION_REQUESTED', 'CORRECTION_RECOMMENDED', 'CORRECTION_AUTHORIZED')
    GROUP BY "student_profile_id", "attendance_record_id"
    HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "attendance_discrepancies"
    WHERE "assessment_attendance_id" IS NOT NULL
      AND "status" IN ('PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'CLARIFICATION_REQUESTED', 'CORRECTION_RECOMMENDED', 'CORRECTION_AUTHORIZED')
    GROUP BY "student_profile_id", "assessment_attendance_id"
    HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "attendance_discrepancies"
    WHERE "attendance_attempt_id" IS NOT NULL
      AND "status" IN ('PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'CLARIFICATION_REQUESTED', 'CORRECTION_RECOMMENDED', 'CORRECTION_AUTHORIZED')
    GROUP BY "student_profile_id", "attendance_attempt_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active discrepancy per student/source while duplicate active discrepancies exist'
      USING HINT = 'Reconcile duplicate active discrepancies without deleting their decision or audit history, then retry this migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "attendance_discrepancy_comments"
    WHERE "clarification_decision_id" IS NOT NULL
    GROUP BY "clarification_decision_id", "author_user_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one response per clarification decision while duplicate responses exist'
      USING HINT = 'Reconcile duplicate responses without deleting their history, then retry this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "attendance_discrepancies_active_record_source_uidx"
  ON "attendance_discrepancies"("student_profile_id", "attendance_record_id")
  WHERE "attendance_record_id" IS NOT NULL
    AND "status" IN ('PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'CLARIFICATION_REQUESTED', 'CORRECTION_RECOMMENDED', 'CORRECTION_AUTHORIZED');

CREATE UNIQUE INDEX "attendance_discrepancies_active_assessment_source_uidx"
  ON "attendance_discrepancies"("student_profile_id", "assessment_attendance_id")
  WHERE "assessment_attendance_id" IS NOT NULL
    AND "status" IN ('PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'CLARIFICATION_REQUESTED', 'CORRECTION_RECOMMENDED', 'CORRECTION_AUTHORIZED');

CREATE UNIQUE INDEX "attendance_discrepancies_active_attempt_source_uidx"
  ON "attendance_discrepancies"("student_profile_id", "attendance_attempt_id")
  WHERE "attendance_attempt_id" IS NOT NULL
    AND "status" IN ('PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'CLARIFICATION_REQUESTED', 'CORRECTION_RECOMMENDED', 'CORRECTION_AUTHORIZED');

CREATE UNIQUE INDEX "attendance_discrepancy_comments_clarification_author_key"
  ON "attendance_discrepancy_comments"("clarification_decision_id", "author_user_id");
