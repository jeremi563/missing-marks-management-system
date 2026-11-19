ALTER TABLE "academic_periods"
ADD COLUMN "enrollment_opens_at" TIMESTAMP(3),
ADD COLUMN "enrollment_closes_at" TIMESTAMP(3);

CREATE TYPE "DepartmentMembershipRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "department_membership_requests" (
    "id" UUID NOT NULL,
    "lecturer_user_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "status" "DepartmentMembershipRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_membership_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "department_membership_requests_lecturer_user_id_department_id_key"
ON "department_membership_requests"("lecturer_user_id", "department_id");
CREATE INDEX "department_membership_requests_department_id_status_created_at_idx"
ON "department_membership_requests"("department_id", "status", "created_at");
CREATE INDEX "department_membership_requests_reviewed_by_user_id_reviewed_at_idx"
ON "department_membership_requests"("reviewed_by_user_id", "reviewed_at");

ALTER TABLE "department_membership_requests"
ADD CONSTRAINT "department_membership_requests_lecturer_user_id_fkey"
FOREIGN KEY ("lecturer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_membership_requests"
ADD CONSTRAINT "department_membership_requests_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "department_membership_requests"
ADD CONSTRAINT "department_membership_requests_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
