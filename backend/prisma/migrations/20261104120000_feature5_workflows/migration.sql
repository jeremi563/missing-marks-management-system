ALTER TABLE "departments"
  ADD COLUMN "designated_cod_user_id" UUID;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_designated_cod_user_id_fkey"
  FOREIGN KEY ("designated_cod_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "departments_designated_cod_user_id_idx" ON "departments"("designated_cod_user_id");

CREATE TABLE "assessment_types" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessment_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assessment_types_code_key" ON "assessment_types"("code");
CREATE UNIQUE INDEX "assessment_types_name_key" ON "assessment_types"("name");

ALTER TABLE "missing_mark_reports"
  ADD COLUMN "assessment_type_id" UUID,
  ADD COLUMN "assessment_type_other_description" TEXT;
ALTER TABLE "missing_mark_reports"
  ADD CONSTRAINT "missing_mark_reports_assessment_type_id_fkey"
  FOREIGN KEY ("assessment_type_id") REFERENCES "assessment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "missing_mark_reports_assessment_type_id_idx" ON "missing_mark_reports"("assessment_type_id");

ALTER TABLE "report_assignments"
  ADD COLUMN "work_started_at" TIMESTAMP(3),
  ADD COLUMN "deadline_at" TIMESTAMP(3);
CREATE INDEX "report_assignments_new_lecturer_profile_id_deadline_at_idx"
  ON "report_assignments"("new_lecturer_profile_id", "deadline_at");

ALTER TABLE "appeals"
  ADD COLUMN "decision_by_user_id" UUID,
  ADD COLUMN "decision_at" TIMESTAMP(3),
  ADD COLUMN "decision_reason" TEXT,
  ADD COLUMN "review_deadline_at" TIMESTAMP(3);
ALTER TABLE "appeals"
  ADD CONSTRAINT "appeals_decision_by_user_id_fkey"
  FOREIGN KEY ("decision_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "appeals_status_review_deadline_at_idx" ON "appeals"("status", "review_deadline_at");
CREATE UNIQUE INDEX "appeals_report_id_key" ON "appeals"("report_id");

CREATE TABLE "special_case_categories" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "managed_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_case_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "special_case_categories_code_key" ON "special_case_categories"("code");
CREATE UNIQUE INDEX "special_case_categories_name_key" ON "special_case_categories"("name");
ALTER TABLE "special_case_categories"
  ADD CONSTRAINT "special_case_categories_managed_by_user_id_fkey"
  FOREIGN KEY ("managed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "special_cases_report_id_key";
ALTER TABLE "special_cases"
  ADD COLUMN "submitted_by_user_id" UUID,
  ADD COLUMN "category_id" UUID,
  ADD COLUMN "decision_by_user_id" UUID,
  ADD COLUMN "decision_at" TIMESTAMP(3),
  ADD COLUMN "decision_reason" TEXT,
  ADD COLUMN "review_deadline_at" TIMESTAMP(3);
ALTER TABLE "special_cases"
  ADD CONSTRAINT "special_cases_submitted_by_user_id_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "special_cases_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "special_case_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "special_cases_decision_by_user_id_fkey"
  FOREIGN KEY ("decision_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "special_case_categories" ("id", "code", "name", "is_active", "created_at", "updated_at")
SELECT (md5(category))::uuid, 'LEGACY-' || upper(substr(md5(category), 1, 12)), category, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" AS category FROM "special_cases") legacy
ON CONFLICT ("name") DO NOTHING;
UPDATE "special_cases" sc
SET "category_id" = cat."id"
FROM "special_case_categories" cat
WHERE cat."name" = sc."category" AND sc."category_id" IS NULL;

CREATE INDEX "special_cases_report_id_created_at_idx" ON "special_cases"("report_id", "created_at");
CREATE INDEX "special_cases_submitted_by_user_id_created_at_idx" ON "special_cases"("submitted_by_user_id", "created_at");
CREATE INDEX "special_cases_category_id_idx" ON "special_cases"("category_id");
CREATE INDEX "special_cases_status_review_deadline_at_idx" ON "special_cases"("status", "review_deadline_at");

ALTER TABLE "notifications" ADD COLUMN "dedupe_key" TEXT;
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

CREATE TABLE "public_holidays" (
  "id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "source" TEXT,
  "description" TEXT,
  "managed_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "public_holidays_date_key" ON "public_holidays"("date");
ALTER TABLE "public_holidays"
  ADD CONSTRAINT "public_holidays_managed_by_user_id_fkey"
  FOREIGN KEY ("managed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notification_outbox" (
  "id" UUID NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "report_id" UUID,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "available_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimed_at" TIMESTAMP(3),
  "claimed_by" TEXT,
  "last_error" TEXT,
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key" ON "notification_outbox"("dedupe_key");
CREATE INDEX "notification_outbox_delivered_at_available_at_claimed_at_idx"
  ON "notification_outbox"("delivered_at", "available_at", "claimed_at");
