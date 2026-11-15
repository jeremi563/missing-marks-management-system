ALTER TABLE "attendance_records"
ADD COLUMN "exam_verification_status" TEXT,
ADD COLUMN "exam_verified_by_lecturer_id" UUID,
ADD COLUMN "exam_verified_at" TIMESTAMP(3),
ADD COLUMN "exam_rejection_reason" TEXT,
ADD COLUMN "exam_comments" TEXT;

UPDATE "attendance_records" AS record
SET "exam_verification_status" = 'LEGACY_UNVERIFIED'
FROM "attendance_sessions" AS session
WHERE record."session_id" = session."id"
  AND session."session_type" = 'EXAM';

CREATE INDEX "attendance_records_exam_verification_status_recorded_at_idx"
ON "attendance_records"("exam_verification_status", "recorded_at");

CREATE INDEX "attendance_records_exam_verified_by_lecturer_id_exam_verified_at_idx"
ON "attendance_records"("exam_verified_by_lecturer_id", "exam_verified_at");

ALTER TABLE "attendance_records"
ADD CONSTRAINT "attendance_records_exam_verification_decision_check"
CHECK (
  (
    "exam_verification_status" IS NULL
    AND "exam_verified_by_lecturer_id" IS NULL
    AND "exam_verified_at" IS NULL
    AND "exam_rejection_reason" IS NULL
    AND "exam_comments" IS NULL
  )
  OR (
    "exam_verification_status" = 'LEGACY_UNVERIFIED'
    AND "exam_verified_by_lecturer_id" IS NULL
    AND "exam_verified_at" IS NULL
    AND "exam_rejection_reason" IS NULL
  )
  OR (
    "exam_verification_status" = 'PENDING_REVIEW'
    AND "exam_verified_by_lecturer_id" IS NULL
    AND "exam_verified_at" IS NULL
    AND "exam_rejection_reason" IS NULL
  )
  OR (
    "exam_verification_status" = 'VERIFIED'
    AND "exam_verified_by_lecturer_id" IS NOT NULL
    AND "exam_verified_at" IS NOT NULL
    AND "exam_rejection_reason" IS NULL
  )
  OR (
    "exam_verification_status" = 'REJECTED'
    AND "exam_verified_by_lecturer_id" IS NOT NULL
    AND "exam_verified_at" IS NOT NULL
    AND NULLIF(BTRIM("exam_rejection_reason"), '') IS NOT NULL
  )
);

ALTER TABLE "attendance_records"
ADD CONSTRAINT "attendance_records_exam_verified_by_lecturer_id_fkey"
FOREIGN KEY ("exam_verified_by_lecturer_id") REFERENCES "lecturer_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
