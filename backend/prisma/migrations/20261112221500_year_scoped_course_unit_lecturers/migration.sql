ALTER TABLE "course_unit_lecturers"
ADD COLUMN "academic_year" VARCHAR(7);

UPDATE "course_unit_lecturers"
SET "academic_year" = CASE
    WHEN EXTRACT(MONTH FROM "created_at" AT TIME ZONE 'UTC') >= 7
        THEN EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'UTC')::INTEGER
    ELSE EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'UTC')::INTEGER - 1
END::TEXT || '/' || RIGHT((
    CASE
        WHEN EXTRACT(MONTH FROM "created_at" AT TIME ZONE 'UTC') >= 7
            THEN EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'UTC')::INTEGER + 1
        ELSE EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'UTC')::INTEGER
    END
)::TEXT, 2);

WITH duplicate_assignments AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "course_unit_id", "academic_year"
            ORDER BY "created_at" DESC, "id" DESC
        ) AS assignment_rank
    FROM "course_unit_lecturers"
)
UPDATE "course_unit_lecturers" AS assignments
SET "academic_year" = NULL
FROM duplicate_assignments
WHERE assignments."id" = duplicate_assignments."id"
  AND duplicate_assignments.assignment_rank > 1;

DROP INDEX "course_unit_lecturers_course_unit_id_lecturer_profile_id_key";

CREATE UNIQUE INDEX "course_unit_lecturers_course_unit_id_academic_year_key"
ON "course_unit_lecturers"("course_unit_id", "academic_year");
