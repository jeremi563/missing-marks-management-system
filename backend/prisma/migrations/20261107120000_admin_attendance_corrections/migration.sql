ALTER TABLE "attendance_discrepancy_decisions"
  ADD COLUMN "source_status_at_authorization" TEXT;

ALTER TABLE "attendance_corrections"
  ALTER COLUMN "lecturer_profile_id" DROP NOT NULL,
  ADD COLUMN "administrator_user_id" UUID,
  ADD COLUMN "discrepancy_decision_id" UUID;

ALTER TABLE "attendance_corrections"
  ADD CONSTRAINT "attendance_corrections_administrator_user_id_fkey"
    FOREIGN KEY ("administrator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_corrections_discrepancy_decision_id_fkey"
    FOREIGN KEY ("discrepancy_decision_id") REFERENCES "attendance_discrepancy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_corrections_actor_xor_check"
    CHECK (("lecturer_profile_id" IS NULL) <> ("administrator_user_id" IS NULL));

CREATE UNIQUE INDEX "attendance_corrections_discrepancy_decision_id_key"
  ON "attendance_corrections"("discrepancy_decision_id");
