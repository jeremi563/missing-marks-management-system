ALTER TABLE "attendance_discrepancy_decisions"
  ADD COLUMN "source_type_at_authorization" TEXT,
  ADD COLUMN "source_id_at_authorization" UUID,
  ADD COLUMN "revalidates_decision_id" UUID;

ALTER TABLE "attendance_discrepancy_decisions"
  ADD CONSTRAINT "attendance_discrepancy_decisions_revalidates_decision_id_fkey"
    FOREIGN KEY ("revalidates_decision_id") REFERENCES "attendance_discrepancy_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "attendance_discrepancy_decisions_revalidates_decision_id_key"
  ON "attendance_discrepancy_decisions"("revalidates_decision_id");
