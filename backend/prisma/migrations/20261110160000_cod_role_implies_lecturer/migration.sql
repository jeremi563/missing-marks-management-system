INSERT INTO "roles" ("id", "name", "description", "created_at")
VALUES (gen_random_uuid(), 'lecturer', 'Lecturer', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "user_roles" ("id", "user_id", "role_id", "created_at")
SELECT gen_random_uuid(), cod_assignment."user_id", lecturer_role."id", CURRENT_TIMESTAMP
FROM "user_roles" AS cod_assignment
JOIN "roles" AS cod_role ON cod_role."id" = cod_assignment."role_id" AND cod_role."name" = 'cod'
JOIN "roles" AS lecturer_role ON lecturer_role."name" = 'lecturer'
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_roles" AS lecturer_assignment
  WHERE lecturer_assignment."user_id" = cod_assignment."user_id"
    AND lecturer_assignment."role_id" = lecturer_role."id"
)
ON CONFLICT DO NOTHING;

INSERT INTO "lecturer_profiles" ("id", "user_id", "staff_number", "created_at", "updated_at")
SELECT gen_random_uuid(), cod_assignment."user_id", identifier."value", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user_roles" AS cod_assignment
JOIN "roles" AS cod_role ON cod_role."id" = cod_assignment."role_id" AND cod_role."name" = 'cod'
JOIN "account_login_identifiers" AS identifier
  ON identifier."user_id" = cod_assignment."user_id"
  AND identifier."type" = 'STAFF_NUMBER'
WHERE NOT EXISTS (
  SELECT 1 FROM "lecturer_profiles" AS profile
  WHERE profile."user_id" = cod_assignment."user_id"
)
AND NOT EXISTS (
  SELECT 1 FROM "lecturer_profiles" AS profile
  WHERE profile."staff_number" = identifier."value"
)
ON CONFLICT DO NOTHING;
