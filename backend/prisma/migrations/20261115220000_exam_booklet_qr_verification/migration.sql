ALTER TABLE "attendance_records"
ADD COLUMN "exam_verification_method" TEXT,
ADD COLUMN "exam_verification_actor_user_id" UUID,
ADD COLUMN "exam_verification_actor_at" TIMESTAMP(3);

ALTER TABLE "attendance_records"
ADD CONSTRAINT "attendance_records_exam_verification_actor_user_id_fkey"
FOREIGN KEY ("exam_verification_actor_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
DROP CONSTRAINT "attendance_records_exam_verification_decision_check";

ALTER TABLE "attendance_records"
ADD CONSTRAINT "attendance_records_exam_verification_decision_check"
CHECK (
  (
    "exam_verification_status" IS NULL
    AND "exam_verified_by_lecturer_id" IS NULL
    AND "exam_verified_at" IS NULL
    AND "exam_verification_method" IS NULL
    AND "exam_verification_actor_user_id" IS NULL
    AND "exam_verification_actor_at" IS NULL
    AND "exam_rejection_reason" IS NULL
    AND "exam_comments" IS NULL
  )
  OR (
    "exam_verification_status" = 'LEGACY_UNVERIFIED'
    AND "exam_verified_by_lecturer_id" IS NULL
    AND "exam_verified_at" IS NULL
    AND "exam_verification_method" IS NULL
    AND "exam_verification_actor_user_id" IS NULL
    AND "exam_verification_actor_at" IS NULL
    AND "exam_rejection_reason" IS NULL
  )
  OR (
    "exam_verification_status" = 'PENDING_REVIEW'
    AND "exam_verified_by_lecturer_id" IS NULL
    AND "exam_verified_at" IS NULL
    AND "exam_verification_method" IS NULL
    AND "exam_verification_actor_user_id" IS NULL
    AND "exam_verification_actor_at" IS NULL
    AND "exam_rejection_reason" IS NULL
  )
  OR (
    "exam_verification_status" = 'VERIFIED'
    AND "exam_rejection_reason" IS NULL
    AND (
      (
        "exam_verified_by_lecturer_id" IS NOT NULL
        AND "exam_verified_at" IS NOT NULL
      )
      OR (
        "exam_verification_method" IN ('STUDENT_SCAN', 'INVIGILATOR_SCAN')
        AND "exam_verification_actor_user_id" IS NOT NULL
        AND "exam_verification_actor_at" IS NOT NULL
      )
    )
  )
  OR (
    "exam_verification_status" = 'REJECTED'
    AND "exam_verified_by_lecturer_id" IS NOT NULL
    AND "exam_verified_at" IS NOT NULL
    AND "exam_verification_method" IS NULL
    AND "exam_verification_actor_user_id" IS NULL
    AND "exam_verification_actor_at" IS NULL
    AND NULLIF(BTRIM("exam_rejection_reason"), '') IS NOT NULL
  )
);

CREATE INDEX "attendance_records_exam_verification_actor_user_id_exam_verification_actor_at_idx"
ON "attendance_records"("exam_verification_actor_user_id", "exam_verification_actor_at");

CREATE TABLE "exam_booklets" (
  "id" UUID NOT NULL,
  "booklet_identifier" TEXT NOT NULL,
  "student_profile_id" UUID NOT NULL,
  "assessment_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "token_hash" TEXT,
  "retired_token_hash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
  "verified_at" TIMESTAMP(3),
  "verified_by_user_id" UUID,
  "verification_method" TEXT,
  "replaced_by_booklet_id" UUID,
  "replacement_approved_by_user_id" UUID,
  "replacement_reason" TEXT,
  "replaced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exam_booklets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_booklets_status_check"
    CHECK ("status" IN ('ALLOCATED', 'VERIFIED', 'REPLACED', 'INVALIDATED')),
  CONSTRAINT "exam_booklets_replacement_check"
    CHECK (
      ("status" = 'REPLACED' AND "replaced_by_booklet_id" IS NOT NULL
        AND "replacement_approved_by_user_id" IS NOT NULL
        AND NULLIF(BTRIM("replacement_reason"), '') IS NOT NULL
        AND "replaced_at" IS NOT NULL AND "token_hash" IS NULL
        AND "retired_token_hash" IS NOT NULL)
      OR
      ("status" <> 'REPLACED' AND "replaced_by_booklet_id" IS NULL
        AND "replacement_approved_by_user_id" IS NULL
        AND "replacement_reason" IS NULL AND "replaced_at" IS NULL
        AND "retired_token_hash" IS NULL)
    ),
  CONSTRAINT "exam_booklets_verification_check"
    CHECK (
      ("status" <> 'VERIFIED' AND "verified_at" IS NULL
        AND "verified_by_user_id" IS NULL AND "verification_method" IS NULL)
      OR
      ("status" = 'VERIFIED' AND "verified_at" IS NOT NULL
        AND "verified_by_user_id" IS NOT NULL
        AND "verification_method" IN ('STUDENT_SCAN', 'INVIGILATOR_SCAN'))
    )
);

CREATE TABLE "exam_booklet_scans" (
  "id" UUID NOT NULL,
  "booklet_id" UUID,
  "student_profile_id" UUID,
  "assessment_id" UUID,
  "session_id" UUID,
  "attendance_record_id" UUID,
  "scanner_user_id" UUID NOT NULL,
  "scanner_role" TEXT NOT NULL,
  "scan_method" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "exception_code" TEXT,
  "exception_details" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_booklet_scans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_booklet_scans_method_check"
    CHECK ("scan_method" IN ('STUDENT_SCAN', 'INVIGILATOR_SCAN'))
);

CREATE UNIQUE INDEX "exam_booklets_booklet_identifier_key"
ON "exam_booklets"("booklet_identifier");
CREATE UNIQUE INDEX "exam_booklets_token_hash_key"
ON "exam_booklets"("token_hash");
CREATE UNIQUE INDEX "exam_booklets_retired_token_hash_key"
ON "exam_booklets"("retired_token_hash");
CREATE UNIQUE INDEX "exam_booklets_replaced_by_booklet_id_key"
ON "exam_booklets"("replaced_by_booklet_id");
CREATE UNIQUE INDEX "exam_booklets_one_active_student_assessment_key"
ON "exam_booklets"("student_profile_id", "assessment_id")
WHERE "status" IN ('ALLOCATED', 'VERIFIED');
CREATE UNIQUE INDEX "exam_booklet_scans_one_success_per_booklet_key"
ON "exam_booklet_scans"("booklet_id")
WHERE "booklet_id" IS NOT NULL AND "outcome" = 'SUCCESS';

CREATE INDEX "exam_booklets_student_profile_id_assessment_id_status_idx"
ON "exam_booklets"("student_profile_id", "assessment_id", "status");
CREATE INDEX "exam_booklets_session_id_status_idx"
ON "exam_booklets"("session_id", "status");
CREATE INDEX "exam_booklets_assessment_id_status_idx"
ON "exam_booklets"("assessment_id", "status");
CREATE INDEX "exam_booklet_scans_booklet_id_occurred_at_idx"
ON "exam_booklet_scans"("booklet_id", "occurred_at");
CREATE INDEX "exam_booklet_scans_session_id_occurred_at_idx"
ON "exam_booklet_scans"("session_id", "occurred_at");
CREATE INDEX "exam_booklet_scans_student_profile_id_occurred_at_idx"
ON "exam_booklet_scans"("student_profile_id", "occurred_at");
CREATE INDEX "exam_booklet_scans_scanner_user_id_occurred_at_idx"
ON "exam_booklet_scans"("scanner_user_id", "occurred_at");
CREATE INDEX "exam_booklet_scans_outcome_occurred_at_idx"
ON "exam_booklet_scans"("outcome", "occurred_at");

ALTER TABLE "exam_booklets"
ADD CONSTRAINT "exam_booklets_student_profile_id_fkey"
FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklets_assessment_id_fkey"
FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklets_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklets_verified_by_user_id_fkey"
FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklets_replacement_approved_by_user_id_fkey"
FOREIGN KEY ("replacement_approved_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklets_replaced_by_booklet_id_fkey"
FOREIGN KEY ("replaced_by_booklet_id") REFERENCES "exam_booklets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exam_booklet_scans"
ADD CONSTRAINT "exam_booklet_scans_booklet_id_fkey"
FOREIGN KEY ("booklet_id") REFERENCES "exam_booklets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklet_scans_student_profile_id_fkey"
FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklet_scans_assessment_id_fkey"
FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklet_scans_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklet_scans_attendance_record_id_fkey"
FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "exam_booklet_scans_scanner_user_id_fkey"
FOREIGN KEY ("scanner_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
