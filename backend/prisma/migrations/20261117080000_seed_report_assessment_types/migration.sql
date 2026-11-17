INSERT INTO "assessment_types" ("id", "code", "name", "is_active", "updated_at")
VALUES
  ('b4f64ef7-264c-4aeb-934a-0f480d44f201', 'CAT', 'CAT', true, CURRENT_TIMESTAMP),
  ('b4f64ef7-264c-4aeb-934a-0f480d44f202', 'MAIN_EXAMINATION', 'Main Examination', true, CURRENT_TIMESTAMP),
  ('b4f64ef7-264c-4aeb-934a-0f480d44f203', 'ASSIGNMENT', 'Assignment', true, CURRENT_TIMESTAMP),
  ('b4f64ef7-264c-4aeb-934a-0f480d44f204', 'PRACTICAL', 'Practical', true, CURRENT_TIMESTAMP),
  ('b4f64ef7-264c-4aeb-934a-0f480d44f205', 'SUPPLEMENTARY_EXAMINATION', 'Supplementary Examination', true, CURRENT_TIMESTAMP),
  ('b4f64ef7-264c-4aeb-934a-0f480d44f206', 'SPECIAL_EXAMINATION', 'Special Examination', true, CURRENT_TIMESTAMP),
  ('b4f64ef7-264c-4aeb-934a-0f480d44f207', 'OTHER', 'Other', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "is_active" = true,
    "updated_at" = CURRENT_TIMESTAMP;
