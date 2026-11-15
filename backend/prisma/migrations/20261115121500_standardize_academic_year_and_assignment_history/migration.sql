ALTER TABLE "course_unit_lecturers"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN "ended_at" TIMESTAMP(3);

UPDATE "course_unit_lecturers"
SET "is_active" = FALSE
WHERE "academic_year" IS NULL;

DROP INDEX "course_unit_lecturers_course_unit_id_academic_year_key";

WITH assignment_dates AS (
    SELECT
        "id",
        "created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Nairobi' AS "created_at_nairobi"
    FROM "course_unit_lecturers"
    WHERE "academic_year" IS NOT NULL
)
UPDATE "course_unit_lecturers" AS assignments
SET "academic_year" = CASE
    WHEN EXTRACT(MONTH FROM assignment_dates."created_at_nairobi") >= 9
        THEN EXTRACT(YEAR FROM assignment_dates."created_at_nairobi")::INTEGER
    ELSE EXTRACT(YEAR FROM assignment_dates."created_at_nairobi")::INTEGER - 1
END::TEXT || '/' || RIGHT((
    CASE
        WHEN EXTRACT(MONTH FROM assignment_dates."created_at_nairobi") >= 9
            THEN EXTRACT(YEAR FROM assignment_dates."created_at_nairobi")::INTEGER + 1
        ELSE EXTRACT(YEAR FROM assignment_dates."created_at_nairobi")::INTEGER
    END
)::TEXT, 2)
FROM assignment_dates
WHERE assignments."id" = assignment_dates."id";

WITH duplicate_active_assignments AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "course_unit_id", "academic_year"
            ORDER BY "created_at" DESC, "id" DESC
        ) AS assignment_rank
    FROM "course_unit_lecturers"
    WHERE "is_active" AND "academic_year" IS NOT NULL
)
UPDATE "course_unit_lecturers" AS assignments
SET "is_active" = FALSE
FROM duplicate_active_assignments
WHERE assignments."id" = duplicate_active_assignments."id"
  AND duplicate_active_assignments.assignment_rank > 1;

ALTER TABLE "course_unit_lecturers"
ADD CONSTRAINT "course_unit_lecturers_active_year_check"
CHECK (NOT "is_active" OR "academic_year" IS NOT NULL);

CREATE UNIQUE INDEX "course_unit_lecturers_active_unit_year_key"
ON "course_unit_lecturers"("course_unit_id", "academic_year")
WHERE "is_active" AND "academic_year" IS NOT NULL;
