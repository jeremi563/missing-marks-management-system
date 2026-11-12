ALTER TABLE "departments"
ADD COLUMN "initials" TEXT;

CREATE UNIQUE INDEX "departments_initials_key" ON "departments"("initials");
