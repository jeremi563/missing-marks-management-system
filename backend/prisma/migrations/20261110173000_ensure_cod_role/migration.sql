INSERT INTO "roles" ("id", "name", "description", "created_at")
VALUES (gen_random_uuid(), 'cod', 'Course Officer', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
