ALTER TABLE "cat_submissions"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
ADD COLUMN "rejection_reason" TEXT,
ADD COLUMN "attendance_record_id" UUID;

UPDATE "cat_submissions"
SET "status" = 'LEGACY_REVIEWED'
WHERE "verified_at" IS NOT NULL OR "verified_by_lecturer_id" IS NOT NULL;

ALTER TABLE "cat_submissions"
ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

CREATE UNIQUE INDEX "cat_submissions_attendance_record_id_key"
ON "cat_submissions"("attendance_record_id");

CREATE INDEX "cat_submissions_status_created_at_idx"
ON "cat_submissions"("status", "created_at");

ALTER TABLE "cat_submissions"
ADD CONSTRAINT "cat_submissions_attendance_record_id_fkey"
FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cat_submissions"
ADD CONSTRAINT "cat_submissions_status_decision_check"
CHECK (
  "status" IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'LEGACY_REVIEWED', 'LEGACY_UNVERIFIED')
  AND (
    "status" NOT IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED')
    OR (
      "status" = 'PENDING_REVIEW'
      AND "verified_by_lecturer_id" IS NULL
      AND "verified_at" IS NULL
      AND "rejection_reason" IS NULL
    )
    OR (
      "status" = 'VERIFIED'
      AND "verified_by_lecturer_id" IS NOT NULL
      AND "verified_at" IS NOT NULL
      AND "rejection_reason" IS NULL
    )
    OR (
      "status" = 'REJECTED'
      AND "verified_by_lecturer_id" IS NOT NULL
      AND "verified_at" IS NOT NULL
      AND NULLIF(BTRIM("rejection_reason"), '') IS NOT NULL
    )
  )
);
