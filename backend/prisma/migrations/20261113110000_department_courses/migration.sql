CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "courses_code_format_check" CHECK ("code" ~ '^[0-9]{2}$')
);

CREATE UNIQUE INDEX "courses_department_id_code_key"
ON "courses"("department_id", "code");
CREATE INDEX "courses_department_id_idx" ON "courses"("department_id");

ALTER TABLE "course_units" ADD COLUMN "course_id" UUID;
CREATE INDEX "course_units_course_id_idx" ON "course_units"("course_id");

ALTER TABLE "courses"
ADD CONSTRAINT "courses_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "course_units"
ADD CONSTRAINT "course_units_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
