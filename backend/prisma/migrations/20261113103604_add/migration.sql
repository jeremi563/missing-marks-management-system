-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- RenameIndex
ALTER INDEX "department_membership_requests_department_id_status_created_at_" RENAME TO "department_membership_requests_department_id_status_created_idx";

-- RenameIndex
ALTER INDEX "department_membership_requests_lecturer_user_id_department_id_k" RENAME TO "department_membership_requests_lecturer_user_id_department__key";

-- RenameIndex
ALTER INDEX "department_membership_requests_reviewed_by_user_id_reviewed_at_" RENAME TO "department_membership_requests_reviewed_by_user_id_reviewed_idx";

-- RenameIndex
ALTER INDEX "student_enrollment_requests_student_profile_id_course_unit_id_a" RENAME TO "student_enrollment_requests_student_profile_id_course_unit__key";
