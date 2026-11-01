-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "student_number" TEXT NOT NULL,
    "official_email" TEXT,
    "notification_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "staff_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecturer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_units" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_periods" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_enrollments" (
    "id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "course_unit_id" UUID NOT NULL,
    "academic_period_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_unit_lecturers" (
    "id" UUID NOT NULL,
    "course_unit_id" UUID NOT NULL,
    "lecturer_profile_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_unit_lecturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missing_mark_reports" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "course_unit_id" UUID NOT NULL,
    "academic_period_id" UUID NOT NULL,
    "assessment_id" UUID,
    "assigned_lecturer_profile_id" UUID,
    "assessment_component" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missing_mark_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" UUID NOT NULL,
    "course_unit_id" UUID NOT NULL,
    "lecturer_profile_id" UUID NOT NULL,
    "classroom_id" UUID,
    "assessment_id" UUID,
    "access_token_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "location_verified" BOOLEAN NOT NULL DEFAULT false,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "comments" TEXT,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "report_id" UUID,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "course_unit_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assessment_date" TIMESTAMP(3),
    "maximum_marks" DECIMAL(8,2),
    "required_for_eligibility" BOOLEAN NOT NULL DEFAULT false,
    "attendance_required" BOOLEAN NOT NULL DEFAULT false,
    "submission_required" BOOLEAN NOT NULL DEFAULT false,
    "qr_reference_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "boundary_meters" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_attempts" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "failure_reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_history" (
    "id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "student_profile_id" UUID NOT NULL,
    "course_unit_code" TEXT NOT NULL,
    "course_unit_name" TEXT NOT NULL,
    "session_started_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "location_verified" BOOLEAN NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "lecturer_profile_id" UUID NOT NULL,
    "original_status" TEXT NOT NULL,
    "corrected_status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attendance" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_submissions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "verified_by_lecturer_id" UUID,
    "verified_at" TIMESTAMP(3),
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cat_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_cases" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_case_evidence" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "appeal_id" UUID,
    "special_case_id" UUID,
    "uploaded_by_user_id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "special_case_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_discrepancies" (
    "id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "attendance_record_id" UUID,
    "assessment_attendance_id" UUID,
    "attendance_attempt_id" UUID,
    "assigned_lecturer_profile_id" UUID,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_discrepancy_comments" (
    "id" UUID NOT NULL,
    "discrepancy_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_discrepancy_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_comments" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_assignments" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "previous_lecturer_profile_id" UUID,
    "new_lecturer_profile_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_status_history" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "attendance_excuse_requests" (
    "id" UUID NOT NULL,
    "attendance_record_id" UUID NOT NULL,
    "student_profile_id" UUID NOT NULL,
    "reviewed_by_lecturer_id" UUID,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "decision_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_excuse_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_eligibility" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "checked_by_user_id" UUID,
    "classification" TEXT NOT NULL,
    "attendance_percentage" DECIMAL(5,2),
    "class_attendance_eligible" BOOLEAN,
    "cat_attendance_eligible" BOOLEAN,
    "examination_attendance_eligible" BOOLEAN,
    "details" JSONB,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark_corrections" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "proposed_by_lecturer_id" UUID NOT NULL,
    "reviewed_by_user_id" UUID,
    "original_value" DECIMAL(8,2),
    "proposed_value" DECIMAL(8,2) NOT NULL,
    "final_value" DECIMAL(8,2),
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "review_comments" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mark_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_student_number_key" ON "student_profiles"("student_number");

-- CreateIndex
CREATE UNIQUE INDEX "lecturer_profiles_user_id_key" ON "lecturer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturer_profiles_staff_number_key" ON "lecturer_profiles"("staff_number");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "department_memberships_department_id_idx" ON "department_memberships"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_memberships_user_id_department_id_key" ON "department_memberships"("user_id", "department_id");

-- CreateIndex
CREATE INDEX "course_units_code_idx" ON "course_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "course_units_department_id_code_key" ON "course_units"("department_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "academic_periods_code_key" ON "academic_periods"("code");

-- CreateIndex
CREATE INDEX "academic_periods_name_idx" ON "academic_periods"("name");

-- CreateIndex
CREATE INDEX "unit_enrollments_course_unit_id_academic_period_id_idx" ON "unit_enrollments"("course_unit_id", "academic_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_enrollments_student_profile_id_course_unit_id_academic_key" ON "unit_enrollments"("student_profile_id", "course_unit_id", "academic_period_id");

-- CreateIndex
CREATE INDEX "course_unit_lecturers_lecturer_profile_id_idx" ON "course_unit_lecturers"("lecturer_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_unit_lecturers_course_unit_id_lecturer_profile_id_key" ON "course_unit_lecturers"("course_unit_id", "lecturer_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "missing_mark_reports_reference_key" ON "missing_mark_reports"("reference");

-- CreateIndex
CREATE INDEX "missing_mark_reports_student_profile_id_status_idx" ON "missing_mark_reports"("student_profile_id", "status");

-- CreateIndex
CREATE INDEX "missing_mark_reports_assigned_lecturer_profile_id_status_idx" ON "missing_mark_reports"("assigned_lecturer_profile_id", "status");

-- CreateIndex
CREATE INDEX "missing_mark_reports_course_unit_id_academic_period_id_idx" ON "missing_mark_reports"("course_unit_id", "academic_period_id");

-- CreateIndex
CREATE INDEX "missing_mark_reports_assessment_id_idx" ON "missing_mark_reports"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_sessions_access_token_hash_key" ON "attendance_sessions"("access_token_hash");

-- CreateIndex
CREATE INDEX "attendance_sessions_course_unit_id_starts_at_idx" ON "attendance_sessions"("course_unit_id", "starts_at");

-- CreateIndex
CREATE INDEX "attendance_sessions_lecturer_profile_id_idx" ON "attendance_sessions"("lecturer_profile_id");

-- CreateIndex
CREATE INDEX "attendance_sessions_assessment_id_idx" ON "attendance_sessions"("assessment_id");

-- CreateIndex
CREATE INDEX "attendance_records_student_profile_id_recorded_at_idx" ON "attendance_records"("student_profile_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_session_id_student_profile_id_key" ON "attendance_records"("session_id", "student_profile_id");

-- CreateIndex
CREATE INDEX "appeals_report_id_created_at_idx" ON "appeals"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "appeals_student_profile_id_idx" ON "appeals"("student_profile_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_report_id_created_at_idx" ON "notifications"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_qr_reference_hash_key" ON "assessments"("qr_reference_hash");

-- CreateIndex
CREATE INDEX "assessments_course_unit_id_type_idx" ON "assessments"("course_unit_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_course_unit_id_code_key" ON "assessments"("course_unit_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_name_key" ON "classrooms"("name");

-- CreateIndex
CREATE INDEX "attendance_attempts_session_id_occurred_at_idx" ON "attendance_attempts"("session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "attendance_attempts_student_profile_id_occurred_at_idx" ON "attendance_attempts"("student_profile_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_history_attendance_record_id_key" ON "attendance_history"("attendance_record_id");

-- CreateIndex
CREATE INDEX "attendance_history_student_profile_id_signed_at_idx" ON "attendance_history"("student_profile_id", "signed_at");

-- CreateIndex
CREATE INDEX "attendance_corrections_attendance_record_id_created_at_idx" ON "attendance_corrections"("attendance_record_id", "created_at");

-- CreateIndex
CREATE INDEX "assessment_attendance_student_profile_id_recorded_at_idx" ON "assessment_attendance"("student_profile_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attendance_assessment_id_student_profile_id_key" ON "assessment_attendance"("assessment_id", "student_profile_id");

-- CreateIndex
CREATE INDEX "cat_submissions_verified_by_lecturer_id_verified_at_idx" ON "cat_submissions"("verified_by_lecturer_id", "verified_at");

-- CreateIndex
CREATE UNIQUE INDEX "cat_submissions_assessment_id_student_profile_id_key" ON "cat_submissions"("assessment_id", "student_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "special_cases_report_id_key" ON "special_cases"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "special_case_evidence_storage_key_key" ON "special_case_evidence"("storage_key");

-- CreateIndex
CREATE INDEX "special_case_evidence_report_id_created_at_idx" ON "special_case_evidence"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "special_case_evidence_appeal_id_idx" ON "special_case_evidence"("appeal_id");

-- CreateIndex
CREATE INDEX "special_case_evidence_special_case_id_idx" ON "special_case_evidence"("special_case_id");

-- CreateIndex
CREATE INDEX "attendance_discrepancies_student_profile_id_status_idx" ON "attendance_discrepancies"("student_profile_id", "status");

-- CreateIndex
CREATE INDEX "attendance_discrepancies_assigned_lecturer_profile_id_statu_idx" ON "attendance_discrepancies"("assigned_lecturer_profile_id", "status");

-- CreateIndex
CREATE INDEX "attendance_discrepancy_comments_discrepancy_id_created_at_idx" ON "attendance_discrepancy_comments"("discrepancy_id", "created_at");

-- CreateIndex
CREATE INDEX "report_comments_report_id_created_at_idx" ON "report_comments"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "report_assignments_report_id_created_at_idx" ON "report_assignments"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "report_assignments_new_lecturer_profile_id_created_at_idx" ON "report_assignments"("new_lecturer_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "report_status_history_report_id_created_at_idx" ON "report_status_history"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "attendance_excuse_requests_student_profile_id_status_idx" ON "attendance_excuse_requests"("student_profile_id", "status");

-- CreateIndex
CREATE INDEX "attendance_excuse_requests_reviewed_by_lecturer_id_status_idx" ON "attendance_excuse_requests"("reviewed_by_lecturer_id", "status");

-- CreateIndex
CREATE INDEX "report_eligibility_report_id_checked_at_idx" ON "report_eligibility"("report_id", "checked_at");

-- CreateIndex
CREATE INDEX "mark_corrections_report_id_created_at_idx" ON "mark_corrections"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "mark_corrections_reviewed_by_user_id_status_idx" ON "mark_corrections"("reviewed_by_user_id", "status");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_profiles" ADD CONSTRAINT "lecturer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_memberships" ADD CONSTRAINT "department_memberships_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_units" ADD CONSTRAINT "course_units_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_enrollments" ADD CONSTRAINT "unit_enrollments_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_enrollments" ADD CONSTRAINT "unit_enrollments_course_unit_id_fkey" FOREIGN KEY ("course_unit_id") REFERENCES "course_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_enrollments" ADD CONSTRAINT "unit_enrollments_academic_period_id_fkey" FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_unit_lecturers" ADD CONSTRAINT "course_unit_lecturers_course_unit_id_fkey" FOREIGN KEY ("course_unit_id") REFERENCES "course_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_unit_lecturers" ADD CONSTRAINT "course_unit_lecturers_lecturer_profile_id_fkey" FOREIGN KEY ("lecturer_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missing_mark_reports" ADD CONSTRAINT "missing_mark_reports_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missing_mark_reports" ADD CONSTRAINT "missing_mark_reports_course_unit_id_fkey" FOREIGN KEY ("course_unit_id") REFERENCES "course_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missing_mark_reports" ADD CONSTRAINT "missing_mark_reports_academic_period_id_fkey" FOREIGN KEY ("academic_period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missing_mark_reports" ADD CONSTRAINT "missing_mark_reports_assigned_lecturer_profile_id_fkey" FOREIGN KEY ("assigned_lecturer_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missing_mark_reports" ADD CONSTRAINT "missing_mark_reports_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_course_unit_id_fkey" FOREIGN KEY ("course_unit_id") REFERENCES "course_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_lecturer_profile_id_fkey" FOREIGN KEY ("lecturer_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_unit_id_fkey" FOREIGN KEY ("course_unit_id") REFERENCES "course_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_attempts" ADD CONSTRAINT "attendance_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_attempts" ADD CONSTRAINT "attendance_attempts_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_history" ADD CONSTRAINT "attendance_history_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_history" ADD CONSTRAINT "attendance_history_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_lecturer_profile_id_fkey" FOREIGN KEY ("lecturer_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attendance" ADD CONSTRAINT "assessment_attendance_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attendance" ADD CONSTRAINT "assessment_attendance_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_submissions" ADD CONSTRAINT "cat_submissions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_submissions" ADD CONSTRAINT "cat_submissions_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_submissions" ADD CONSTRAINT "cat_submissions_verified_by_lecturer_id_fkey" FOREIGN KEY ("verified_by_lecturer_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_cases" ADD CONSTRAINT "special_cases_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_case_evidence" ADD CONSTRAINT "special_case_evidence_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_case_evidence" ADD CONSTRAINT "special_case_evidence_appeal_id_fkey" FOREIGN KEY ("appeal_id") REFERENCES "appeals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_case_evidence" ADD CONSTRAINT "special_case_evidence_special_case_id_fkey" FOREIGN KEY ("special_case_id") REFERENCES "special_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_case_evidence" ADD CONSTRAINT "special_case_evidence_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_discrepancies" ADD CONSTRAINT "attendance_discrepancies_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_discrepancies" ADD CONSTRAINT "attendance_discrepancies_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_discrepancies" ADD CONSTRAINT "attendance_discrepancies_assessment_attendance_id_fkey" FOREIGN KEY ("assessment_attendance_id") REFERENCES "assessment_attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_discrepancies" ADD CONSTRAINT "attendance_discrepancies_attendance_attempt_id_fkey" FOREIGN KEY ("attendance_attempt_id") REFERENCES "attendance_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_discrepancies" ADD CONSTRAINT "attendance_discrepancies_assigned_lecturer_profile_id_fkey" FOREIGN KEY ("assigned_lecturer_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_discrepancy_comments" ADD CONSTRAINT "attendance_discrepancy_comments_discrepancy_id_fkey" FOREIGN KEY ("discrepancy_id") REFERENCES "attendance_discrepancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_discrepancy_comments" ADD CONSTRAINT "attendance_discrepancy_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_assignments" ADD CONSTRAINT "report_assignments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_assignments" ADD CONSTRAINT "report_assignments_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_assignments" ADD CONSTRAINT "report_assignments_previous_lecturer_profile_id_fkey" FOREIGN KEY ("previous_lecturer_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_assignments" ADD CONSTRAINT "report_assignments_new_lecturer_profile_id_fkey" FOREIGN KEY ("new_lecturer_profile_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_excuse_requests" ADD CONSTRAINT "attendance_excuse_requests_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_excuse_requests" ADD CONSTRAINT "attendance_excuse_requests_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_excuse_requests" ADD CONSTRAINT "attendance_excuse_requests_reviewed_by_lecturer_id_fkey" FOREIGN KEY ("reviewed_by_lecturer_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_eligibility" ADD CONSTRAINT "report_eligibility_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_eligibility" ADD CONSTRAINT "report_eligibility_checked_by_user_id_fkey" FOREIGN KEY ("checked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "missing_mark_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_proposed_by_lecturer_id_fkey" FOREIGN KEY ("proposed_by_lecturer_id") REFERENCES "lecturer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
