UPDATE "users"
SET "email_verified_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
WHERE "approval_status" = 'APPROVED' AND "email_verified_at" IS NULL;

INSERT INTO "account_login_identifiers" ("id", "user_id", "type", "value")
SELECT gen_random_uuid(), profile."user_id", 'STUDENT_NUMBER', UPPER(BTRIM(profile."student_number"))
FROM "student_profiles" AS profile
WHERE BTRIM(profile."student_number") <> ''
ON CONFLICT ("value") DO NOTHING;

INSERT INTO "account_login_identifiers" ("id", "user_id", "type", "value")
SELECT gen_random_uuid(), profile."user_id", 'STAFF_NUMBER', UPPER(BTRIM(profile."staff_number"))
FROM "lecturer_profiles" AS profile
WHERE profile."staff_number" IS NOT NULL AND BTRIM(profile."staff_number") <> ''
ON CONFLICT ("value") DO NOTHING;

INSERT INTO "account_login_identifiers" ("id", "user_id", "type", "value")
SELECT gen_random_uuid(), account."id", 'ADMIN_NUMBER', 'ADMIN-' || REPLACE(UPPER(account."id"::TEXT), '-', '')
FROM "users" AS account
JOIN "user_roles" AS assignment ON assignment."user_id" = account."id"
JOIN "roles" AS role ON role."id" = assignment."role_id" AND role."name" = 'administrator'
WHERE NOT EXISTS (
  SELECT 1 FROM "account_login_identifiers" AS identifier WHERE identifier."user_id" = account."id"
)
ON CONFLICT ("value") DO NOTHING;