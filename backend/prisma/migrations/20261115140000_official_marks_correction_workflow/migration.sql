CREATE TABLE "student_marks" (
    "id" UUID NOT NULL,
    "unit_enrollment_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "entered_by_lecturer_id" UUID NOT NULL,
    "value" DECIMAL(8,2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_marks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_marks_value_nonnegative" CHECK ("value" >= 0),
    CONSTRAINT "student_marks_version_positive" CHECK ("version" > 0),
    CONSTRAINT "student_marks_unit_enrollment_id_fkey"
        FOREIGN KEY ("unit_enrollment_id") REFERENCES "unit_enrollments"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "student_marks_assessment_id_fkey"
        FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "student_marks_entered_by_lecturer_id_fkey"
        FOREIGN KEY ("entered_by_lecturer_id") REFERENCES "lecturer_profiles"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "student_marks_unit_enrollment_id_assessment_id_key"
    ON "student_marks"("unit_enrollment_id", "assessment_id");
CREATE INDEX "student_marks_assessment_id_unit_enrollment_id_idx"
    ON "student_marks"("assessment_id", "unit_enrollment_id");

ALTER TABLE "mark_corrections"
    ADD COLUMN "mark_id" UUID,
    ADD COLUMN "base_mark_version" INTEGER,
    ADD COLUMN "baseline_verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "mark_corrections"
    ADD CONSTRAINT "mark_corrections_mark_id_fkey"
    FOREIGN KEY ("mark_id") REFERENCES "student_marks"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "mark_corrections_mark_id_idx" ON "mark_corrections"("mark_id");

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "mark_corrections"
        WHERE "status" = 'PENDING_REVIEW'
        GROUP BY "report_id"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add one-pending-mark-correction-per-report constraint: duplicate pending corrections exist; resolve them without deleting history, then retry.';
    END IF;
END $$;

CREATE UNIQUE INDEX "mark_corrections_one_pending_per_report_key"
    ON "mark_corrections"("report_id")
    WHERE "status" = 'PENDING_REVIEW';

CREATE FUNCTION enforce_student_mark_assessment_enrollment_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    enrollment_course_unit_id UUID;
    assessment_course_unit_id UUID;
BEGIN
    SELECT "course_unit_id" INTO enrollment_course_unit_id
    FROM "unit_enrollments" WHERE "id" = NEW."unit_enrollment_id";

    SELECT "course_unit_id" INTO assessment_course_unit_id
    FROM "assessments" WHERE "id" = NEW."assessment_id";

    IF enrollment_course_unit_id IS NULL
       OR assessment_course_unit_id IS NULL
       OR enrollment_course_unit_id <> assessment_course_unit_id THEN
        RAISE EXCEPTION 'Student mark assessment must belong to the enrolled course unit'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "student_marks_validate_assessment_enrollment_unit"
    BEFORE INSERT OR UPDATE OF "unit_enrollment_id", "assessment_id"
    ON "student_marks"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_student_mark_assessment_enrollment_unit();

CREATE FUNCTION prevent_student_mark_course_unit_mismatch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."course_unit_id" IS DISTINCT FROM OLD."course_unit_id" AND EXISTS (
        SELECT 1
        FROM "student_marks" mark
        JOIN "unit_enrollments" enrollment ON enrollment."id" = mark."unit_enrollment_id"
        JOIN "assessments" assessment ON assessment."id" = mark."assessment_id"
        WHERE (TG_TABLE_NAME = 'unit_enrollments' AND enrollment."id" = OLD."id"
               AND assessment."course_unit_id" <> NEW."course_unit_id")
           OR (TG_TABLE_NAME = 'assessments' AND assessment."id" = OLD."id"
               AND enrollment."course_unit_id" <> NEW."course_unit_id")
    ) THEN
        RAISE EXCEPTION 'Course unit cannot be changed while it would invalidate a student mark'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "unit_enrollments_preserve_student_mark_course_unit"
    BEFORE UPDATE OF "course_unit_id" ON "unit_enrollments"
    FOR EACH ROW EXECUTE FUNCTION prevent_student_mark_course_unit_mismatch();

CREATE TRIGGER "assessments_preserve_student_mark_course_unit"
    BEFORE UPDATE OF "course_unit_id" ON "assessments"
    FOR EACH ROW EXECUTE FUNCTION prevent_student_mark_course_unit_mismatch();
