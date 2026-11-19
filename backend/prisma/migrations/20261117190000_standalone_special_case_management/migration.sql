BEGIN;

DO $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO conflict_count
  FROM (
    SELECT report.student_profile_id, report.assessment_id
    FROM special_cases AS special_case
    JOIN missing_mark_reports AS report ON report.id = special_case.report_id
    WHERE report.assessment_id IS NOT NULL
    GROUP BY report.student_profile_id, report.assessment_id
    HAVING COUNT(*) > 1
  ) AS duplicate_applications;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add the special-case student/assessment uniqueness constraint: % conflicting historical student/assessment pairs exist. Review and resolve them explicitly before retrying.',
      conflict_count;
  END IF;
END
$$;

ALTER TABLE "special_cases"
  ADD COLUMN "student_profile_id" UUID,
  ADD COLUMN "course_unit_id" UUID,
  ADD COLUMN "academic_period_id" UUID,
  ADD COLUMN "assessment_id" UUID,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "scheduling_deadline_at" TIMESTAMP(3),
  ADD COLUMN "authorized_reschedules" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "administrative_resolution_required" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "report_id" DROP NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'PENDING_LECTURER_REVIEW';

ALTER TABLE "special_cases"
  ADD CONSTRAINT "special_cases_authorized_reschedules_check" CHECK ("authorized_reschedules" >= 0);

UPDATE "special_cases" AS special_case
SET
  "student_profile_id" = report."student_profile_id",
  "course_unit_id" = report."course_unit_id",
  "academic_period_id" = report."academic_period_id",
  "assessment_id" = report."assessment_id",
  "submitted_at" = special_case."created_at"
FROM "missing_mark_reports" AS report
WHERE report."id" = special_case."report_id";

ALTER TABLE "special_case_evidence"
  ALTER COLUMN "report_id" DROP NOT NULL;

CREATE TABLE "special_case_reviews" (
  "id" UUID NOT NULL,
  "special_case_id" UUID NOT NULL,
  "reviewer_user_id" UUID NOT NULL,
  "reviewer_role" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "decision" TEXT,
  "comments" TEXT,
  "previous_status" TEXT,
  "new_status" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "special_case_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_case_schedules" (
  "id" UUID NOT NULL,
  "special_case_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "venue" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "scheduled_by_user_id" UUID NOT NULL,
  "acknowledged_at" TIMESTAMP(3),
  "acknowledged_by_user_id" UUID,
  "supersedes_schedule_id" UUID,
  "change_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "special_case_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "special_case_schedules_version_check" CHECK ("version" > 0),
  CONSTRAINT "special_case_schedules_time_check" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "special_case_schedules_status_check" CHECK ("status" IN ('SCHEDULED', 'CANCELLED', 'REPLACED'))
);

CREATE TABLE "special_case_attendances" (
  "id" UUID NOT NULL,
  "special_case_id" UUID NOT NULL,
  "schedule_id" UUID NOT NULL,
  "outcome" TEXT NOT NULL,
  "recorded_by_user_id" UUID NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remarks" TEXT,
  CONSTRAINT "special_case_attendances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "special_case_attendances_outcome_check" CHECK ("outcome" IN ('ATTENDED', 'DID_NOT_ATTEND'))
);

CREATE TABLE "special_case_department_configs" (
  "id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "scheduling_days" INTEGER NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_case_department_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "special_case_department_configs_scheduling_days_check" CHECK ("scheduling_days" > 0)
);

CREATE UNIQUE INDEX "special_cases_student_profile_id_assessment_id_key"
  ON "special_cases"("student_profile_id", "assessment_id");
CREATE INDEX "special_cases_student_profile_id_created_at_idx"
  ON "special_cases"("student_profile_id", "created_at");
CREATE INDEX "special_cases_course_unit_id_academic_period_id_status_idx"
  ON "special_cases"("course_unit_id", "academic_period_id", "status");
CREATE INDEX "special_cases_administrative_resolution_required_status_idx"
  ON "special_cases"("administrative_resolution_required", "status");
CREATE INDEX "special_cases_status_scheduling_deadline_at_idx"
  ON "special_cases"("status", "scheduling_deadline_at");

CREATE INDEX "special_case_reviews_special_case_id_created_at_idx"
  ON "special_case_reviews"("special_case_id", "created_at");
CREATE INDEX "special_case_reviews_reviewer_user_id_created_at_idx"
  ON "special_case_reviews"("reviewer_user_id", "created_at");

CREATE UNIQUE INDEX "special_case_schedules_special_case_id_version_key"
  ON "special_case_schedules"("special_case_id", "version");
CREATE INDEX "special_case_schedules_special_case_id_status_version_idx"
  ON "special_case_schedules"("special_case_id", "status", "version");
CREATE INDEX "special_case_schedules_starts_at_status_idx"
  ON "special_case_schedules"("starts_at", "status");
CREATE UNIQUE INDEX "special_case_attendances_schedule_id_key"
  ON "special_case_attendances"("schedule_id");
CREATE INDEX "special_case_attendances_special_case_id_recorded_at_idx"
  ON "special_case_attendances"("special_case_id", "recorded_at");
CREATE UNIQUE INDEX "special_case_department_configs_department_id_key"
  ON "special_case_department_configs"("department_id");

ALTER TABLE "special_cases"
  ADD CONSTRAINT "special_cases_student_profile_id_fkey"
    FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_cases_course_unit_id_fkey"
    FOREIGN KEY ("course_unit_id") REFERENCES "course_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_cases_academic_period_id_fkey"
    FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_cases_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "special_case_reviews"
  ADD CONSTRAINT "special_case_reviews_special_case_id_fkey"
    FOREIGN KEY ("special_case_id") REFERENCES "special_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_case_reviews_reviewer_user_id_fkey"
    FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "special_case_schedules"
  ADD CONSTRAINT "special_case_schedules_special_case_id_fkey"
    FOREIGN KEY ("special_case_id") REFERENCES "special_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_case_schedules_scheduled_by_user_id_fkey"
    FOREIGN KEY ("scheduled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_case_schedules_acknowledged_by_user_id_fkey"
    FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_case_schedules_supersedes_schedule_id_fkey"
    FOREIGN KEY ("supersedes_schedule_id") REFERENCES "special_case_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "special_case_attendances"
  ADD CONSTRAINT "special_case_attendances_special_case_id_fkey"
    FOREIGN KEY ("special_case_id") REFERENCES "special_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_case_attendances_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "special_case_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_case_attendances_recorded_by_user_id_fkey"
    FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "special_case_department_configs"
  ADD CONSTRAINT "special_case_department_configs_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_case_department_configs_updated_by_user_id_fkey"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
