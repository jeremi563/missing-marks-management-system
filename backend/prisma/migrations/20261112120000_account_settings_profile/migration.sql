ALTER TYPE "AccountSecurityTokenType" ADD VALUE 'EMAIL_CHANGE';

ALTER TABLE "users"
ADD COLUMN "pending_email" TEXT,
ADD COLUMN "avatar_data" TEXT;

CREATE UNIQUE INDEX "users_pending_email_key" ON "users"("pending_email");