ALTER TABLE "attendance_discrepancies"
  ADD COLUMN "submitted_by_user_id" UUID,
  ADD COLUMN "submitter_type" TEXT,
  ADD COLUMN "missing_mark_report_id" UUID,
  ADD COLUMN "lecturer_reviewed_by_profile_id" UUID,
  ADD COLUMN "lecturer_reviewed_at" TIMESTAMP(3);

ALTER TABLE "attendance_discrepancies"
  ADD CONSTRAINT "attendance_discrepancies_reporter_fkey"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_discrepancies_missing_mark_report_fkey"
    FOREIGN KEY ("missing_mark_report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_discrepancies_lecturer_reviewer_fkey"
    FOREIGN KEY ("lecturer_reviewed_by_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "attendance_discrepancies_submitted_by_user_id_idx" ON "attendance_discrepancies"("submitted_by_user_id");
CREATE INDEX "attendance_discrepancies_missing_mark_report_id_idx" ON "attendance_discrepancies"("missing_mark_report_id");
CREATE INDEX "attendance_discrepancies_lecturer_review_idx" ON "attendance_discrepancies"("lecturer_reviewed_by_profile_id", "lecturer_reviewed_at");

CREATE TABLE "attendance_discrepancy_decisions" (
  "id" UUID NOT NULL,
  "discrepancy_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "decision" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "previous_status" TEXT,
  "new_status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_discrepancy_decisions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attendance_discrepancy_decisions"
  ADD CONSTRAINT "attendance_discrepancy_decisions_discrepancy_id_fkey"
    FOREIGN KEY ("discrepancy_id") REFERENCES "attendance_discrepancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_discrepancy_decisions_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "attendance_discrepancy_decisions_discrepancy_id_created_at_idx" ON "attendance_discrepancy_decisions"("discrepancy_id", "created_at");
CREATE INDEX "attendance_discrepancy_decisions_actor_user_id_created_at_idx" ON "attendance_discrepancy_decisions"("actor_user_id", "created_at");

ALTER TABLE "attendance_discrepancy_comments"
  ADD COLUMN "clarification_decision_id" UUID;

ALTER TABLE "attendance_discrepancy_comments"
  ADD CONSTRAINT "attendance_discrepancy_comments_clarification_decision_id_fkey"
    FOREIGN KEY ("clarification_decision_id") REFERENCES "attendance_discrepancy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "attendance_discrepancy_comments_clarification_decision_id_idx"
  ON "attendance_discrepancy_comments"("clarification_decision_id");
