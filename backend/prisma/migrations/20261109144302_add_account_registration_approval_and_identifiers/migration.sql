-- CreateEnum
CREATE TYPE "AccountApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoginIdentifierType" AS ENUM ('STUDENT_NUMBER', 'STAFF_NUMBER', 'ADMIN_NUMBER');

-- CreateEnum
CREATE TYPE "AccountSecurityTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- DropIndex
DROP INDEX "appeals_report_id_key";

-- AlterTable
ALTER TABLE "special_cases" ALTER COLUMN "status" SET DEFAULT 'Submitted';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approval_status" "AccountApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "account_login_identifiers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "LoginIdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_login_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_security_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "AccountSecurityTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_security_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_registration_eligibility" (
    "id" UUID NOT NULL,
    "student_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "linked_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_registration_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_login_identifiers_value_key" ON "account_login_identifiers"("value");

-- CreateIndex
CREATE INDEX "account_login_identifiers_user_id_type_idx" ON "account_login_identifiers"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "account_security_tokens_token_hash_key" ON "account_security_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "account_security_tokens_user_id_type_expires_at_idx" ON "account_security_tokens"("user_id", "type", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_eligibility_student_number_key" ON "student_registration_eligibility"("student_number");

-- CreateIndex
CREATE UNIQUE INDEX "student_registration_eligibility_linked_user_id_key" ON "student_registration_eligibility"("linked_user_id");

-- CreateIndex
CREATE INDEX "student_registration_eligibility_email_idx" ON "student_registration_eligibility"("email");

-- RenameForeignKey
ALTER TABLE "attendance_discrepancies" RENAME CONSTRAINT "attendance_discrepancies_lecturer_reviewer_fkey" TO "attendance_discrepancies_lecturer_reviewed_by_profile_id_fkey";

-- RenameForeignKey
ALTER TABLE "attendance_discrepancies" RENAME CONSTRAINT "attendance_discrepancies_missing_mark_report_fkey" TO "attendance_discrepancies_missing_mark_report_id_fkey";

-- RenameForeignKey
ALTER TABLE "attendance_discrepancies" RENAME CONSTRAINT "attendance_discrepancies_reporter_fkey" TO "attendance_discrepancies_submitted_by_user_id_fkey";

-- AddForeignKey
ALTER TABLE "account_login_identifiers" ADD CONSTRAINT "account_login_identifiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_security_tokens" ADD CONSTRAINT "account_security_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_registration_eligibility" ADD CONSTRAINT "student_registration_eligibility_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
