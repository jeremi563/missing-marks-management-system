ALTER TABLE "attendance_sessions"
ADD COLUMN "late_grace_minutes" INTEGER NOT NULL DEFAULT 10;
