# Database Design and Coordination

## 1. Purpose

This document sets the conventions for the shared PostgreSQL database and Prisma schema. The schema is a shared project resource: changes must be coordinated to prevent migration conflicts and inconsistent assumptions between modules.

## 2. Database principles

- Use one PostgreSQL database for the application.
- Use Prisma as the agreed ORM and migration tool.
- Use UUID primary keys for core records unless the team agrees otherwise.
- Use consistent `snake_case` names for database tables and columns.
- Include creation and update timestamps where appropriate.
- Use explicit foreign-key relations and appropriate indexes.
- Apply unique constraints for genuine business uniqueness rules.
- Keep business rules in services, not only in frontend validation.
- Never use real student information as seed or demo data.

## 3. Candidate core entities

These are an initial discussion list, not a final schema. Confirm attributes, relationships and optionality before implementation.

| Entity | Purpose |
|---|---|
| `User` | Login identity, account status and system role or role assignments. |
| `StudentProfile` | Student-specific profile and institutional identifier. |
| `LecturerProfile` | Lecturer-specific profile and staff identifier. |
| `Department` | Academic department or organisational unit. |
| `CourseUnit` | A course/unit offered by the institution. |
| `UnitEnrollment` | Relationship between a student and a unit for an academic period. |
| `MissingMarkReport` | A student's missing-mark case and its current status. |
| `AttendanceSession` | A class or attendance event created by an authorised lecturer. |
| `AttendanceRecord` | A student's attendance record for a session. |
| `Appeal` | An appeal associated with a report, subject to the approved policy. |
| `Notification` | A notification for an authorised user. |
| `AuditLog` | Trace of important actions and decisions. |

Other entities may be required after the team agrees on the full workflow, such as report comments, assignments, CAT records, examination attendance or attachments. Avoid adding speculative tables before the use case is clear.

## 4. Relationship questions to resolve

Before writing the final Prisma schema, agree on:

- Whether one user can have more than one role.
- Whether COD and Academic Officer are the same role or separate roles.
- How departments relate to courses/units and lecturers.
- How academic years, semesters and class groups are represented.
- How student enrolment in a unit is uniquely identified.
- Whether a report refers to a student, unit, semester and assessment component.
- How report assignment history and comments are retained.
- How attendance sessions map to units, dates and lecturers.
- How duplicate attendance records are prevented.
- How the one-appeal-per-report rule is enforced.
- Which actions require audit records and what metadata is safe to store.

## 5. Prisma conventions

- Keep the shared schema in `backend/prisma/schema.prisma`.
- Use Prisma model names consistently (commonly singular PascalCase).
- Map database table and column names to `snake_case` using Prisma mapping where required.
- Name relations clearly, especially where a model has multiple relations to `User`.
- Use enums only for stable, agreed sets of values. If values are expected to be configurable, discuss a related table instead.
- Use transactions when multiple database changes must succeed or fail together.
- Avoid deleting records that are required for academic or audit history; agree on archival/retention rules.
- Add indexes based on query patterns and foreign keys, not indiscriminately.

## 6. Migration workflow

The team lead coordinates schema and migration integration unless the team assigns another maintainer.

1. A contributor describes the feature and the data it needs.
2. The team checks whether an existing model or relation already represents the data.
3. Agree on the field names, types, nullability, relations, constraints and indexes.
4. The schema maintainer updates `schema.prisma` and creates the migration, or explicitly coordinates a contributor to do so.
5. Review the generated migration before applying it.
6. Test the migration against a local development database.
7. Include schema and migration changes in the PR with a clear explanation.
8. Merge only after review and confirmation that the migration is compatible with the current `develop` branch.

Do not have several contributors independently generate migrations from different versions of the shared schema and then merge them without coordination.

## 7. Seed data

Use synthetic, clearly labelled records for development:

- Demo administrator.
- Demo COD / Academic Officer.
- Demo lecturers.
- Demo students.
- Demo departments and units.
- Demo enrolments.

Never copy real student names, registration numbers, marks, passwords or other private data into the repository. Seed passwords must be non-production demo credentials and must be handled safely.

## 8. Environment variables

Keep variable names in `backend/.env.example` and actual local values in `backend/.env`. At minimum, the database connection will require a `DATABASE_URL` in the format supported by Prisma. Do not place actual credentials in this document or commit them to Git.

## 9. Schema change proposal template

When proposing a schema change in an issue or PR, include:

- Feature / user story:
- Why existing models are insufficient:
- Proposed model, fields and types:
- Relationships and deletion behaviour:
- Unique constraints and indexes:
- Which module will use the data:
- Migration impact:
- Privacy / audit considerations: