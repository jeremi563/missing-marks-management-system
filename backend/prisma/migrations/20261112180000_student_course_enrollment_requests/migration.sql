CREATE TYPE "StudentEnrollmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "student_enrollment_requests" (
    "id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "course_unit_id" UUID NOT NULL,
    "academic_period_id" UUID NOT NULL,
    "status" "StudentEnrollmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "decision_note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_enrollment_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_enrollment_requests_student_profile_id_course_unit_id_academic_period_id_key"
ON "student_enrollment_requests"("student_profile_id", "course_unit_id", "academic_period_id");
CREATE INDEX "student_enrollment_requests_status_created_at_idx"
ON "student_enrollment_requests"("status", "created_at");
CREATE INDEX "student_enrollment_requests_course_unit_id_status_idx"
ON "student_enrollment_requests"("course_unit_id", "status");
CREATE INDEX "student_enrollment_requests_reviewed_by_user_id_reviewed_at_idx"
ON "student_enrollment_requests"("reviewed_by_user_id", "reviewed_at");

ALTER TABLE "student_enrollment_requests"
ADD CONSTRAINT "student_enrollment_requests_student_profile_id_fkey"
FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_enrollment_requests"
ADD CONSTRAINT "student_enrollment_requests_course_unit_id_fkey"
FOREIGN KEY ("course_unit_id") REFERENCES "course_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_enrollment_requests"
ADD CONSTRAINT "student_enrollment_requests_academic_period_id_fkey"
FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_enrollment_requests"
ADD CONSTRAINT "student_enrollment_requests_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
