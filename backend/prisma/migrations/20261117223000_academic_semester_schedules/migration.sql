BEGIN;

ALTER TABLE "academic_periods"
  ADD COLUMN "academic_year" TEXT,
  ADD COLUMN "semester" INTEGER,
  ADD COLUMN "schedule_key" TEXT;

ALTER TABLE "academic_periods"
  ADD CONSTRAINT "academic_periods_semester_scope_check"
    CHECK (
      ("semester" IS NULL AND "academic_year" IS NULL AND "schedule_key" IS NULL)
      OR ("semester" IN (1, 2) AND "academic_year" IS NOT NULL AND "schedule_key" IS NOT NULL)
      OR ("semester" = 3 AND "academic_year" IS NOT NULL AND "schedule_key" IS NOT NULL)
    );

CREATE UNIQUE INDEX "academic_periods_schedule_key_key"
  ON "academic_periods"("schedule_key");
CREATE UNIQUE INDEX "academic_periods_academic_year_semester_key"
  ON "academic_periods"("academic_year", "semester");

CREATE TABLE "_AcademicPeriodToCourse" (
  "A" UUID NOT NULL,
  "B" UUID NOT NULL,
  CONSTRAINT "_AcademicPeriodToCourse_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "_AcademicPeriodToCourse_B_index"
  ON "_AcademicPeriodToCourse"("B");

ALTER TABLE "_AcademicPeriodToCourse"
  ADD CONSTRAINT "_AcademicPeriodToCourse_A_fkey"
    FOREIGN KEY ("A") REFERENCES "academic_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "_AcademicPeriodToCourse_B_fkey"
    FOREIGN KEY ("B") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
