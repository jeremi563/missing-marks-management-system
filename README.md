# Missing Marks Management System

**A Web-Based Application for Reporting and Tracking Missing Marks: A Case Study of Kisii University**

## Project Overview

The Missing Marks Management System is a proposed responsive web application designed to streamline the reporting, investigation, tracking, and resolution of missing academic marks at Kisii University.

The system aims to provide a centralized platform where students can report missing marks, track the progress of their cases, receive feedback, and submit appeals where permitted. Lecturers and academic administrators will have structured workflows for investigating cases, making decisions, managing attendance records, and maintaining an auditable history of important actions.

The application will also incorporate attendance management to support missing-mark investigations and eligibility checks.

## Problem Statement

Missing-mark reporting and follow-up can involve communication between students, lecturers, and academic administrators through informal channels and physical visits.

These processes can make it difficult to track case progress, maintain consistent records, resolve attendance discrepancies, manage appeals, and establish accountability for decisions.

This project proposes a centralized digital solution that makes the process more transparent, organized, traceable, and accessible.

## Project Objectives

The project aims to:

- Provide a centralized platform for reporting and tracking missing marks.
- Enable students to monitor case progress and receive feedback.
- Support structured lecturer and departmental review workflows.
- Provide an appeal mechanism for eligible rejected cases.
- Integrate class attendance management using links and QR codes.
- Support CAT attendance, submission confirmation, and lecturer verification.
- Record examination attendance through QR codes embedded in examination booklets.
- Provide attendance history and a discrepancy-resolution workflow.
- Evaluate normal missing-mark eligibility using configured attendance and assessment requirements.
- Support special cases with relevant supporting-document uploads.
- Provide role-based access control and secure handling of academic records.
- Maintain audit trails for important actions and decisions.
- Provide dashboards, notifications, search, filtering, and report exports.

## Core Features

### 1. Missing-Mark Case Management

- Submit missing-mark reports.
- Save and manage drafts.
- Track case status and review progress.
- Assign cases to relevant lecturers.
- Support lecturer and departmental review.
- Record comments, decisions, and case history.
- Support appeals where permitted.
- Prevent duplicate active reports for the same case.

### 2. Attendance Management

- Create class attendance sessions.
- Generate attendance links and QR codes.
- Verify student authentication and unit enrollment.
- Validate student location against the configured classroom boundary.
- Prevent duplicate attendance records.
- Maintain student attendance history.
- Support authorized attendance corrections.
- Provide an attendance discrepancy-reporting workflow.

### 3. CAT Attendance and Submission Tracking

- Create CAT attendance sessions using links and QR codes.
- Allow students to confirm that they have submitted their CATs.
- Allow lecturers to verify CAT submissions.
- Maintain separate records for attendance, student confirmation, and lecturer verification.

### 4. Examination Attendance

- Use QR codes embedded in examination booklets.
- Validate examination attendance requests on the server.
- Record successful examination attendance.
- Prevent duplicate attendance records.

### 5. Special-Case Management

- Handle recognized special circumstances.
- Allow students to provide supporting documents where required.
- Support lecturer and departmental review.
- Maintain case history and decision records.

### 6. Dashboards and Reporting

- Provide role-specific dashboards.
- Display relevant case and attendance information.
- Support search, filtering, and server-side pagination.
- Provide in-app and email notifications.
- Support PDF and Excel report exports.
- Maintain audit trails for important actions.

## User Roles

The system will support four primary user roles:

| Role | Main Responsibilities |
|---|---|
| Student | Submit and track missing-mark reports, view personal attendance history, confirm CAT submissions, and appeal eligible decisions. |
| Lecturer | Investigate assigned cases, manage attendance sessions, verify CAT submissions, resolve attendance discrepancies, and provide recommendations or decisions within the permitted workflow. |
| Coordinator of Department (COD) / Academic Officer | Review departmental cases, handle escalated matters and appeals, make decisions within the assigned authority, and monitor departmental performance. |
| Administrator | Manage accounts and system configuration, monitor system-wide activity, access authorized reports, and oversee administrative operations. |

Access to information and operations will be controlled according to each user's role and permissions.

## Proposed Technology Stack

The following technologies are specified for the initial implementation.

### Frontend
- React.js
- React Router
- Axios
- Plain CSS or CSS Modules
- React built-in state management

### Backend
- Node.js
- Express.js
- RESTful APIs
- JSON
- Zod for request validation
- JWT-based authentication
- bcrypt for password hashing
- Multer for permitted document uploads

### Database and ORM
- PostgreSQL
- Prisma ORM
- Prisma Migrate

### Testing and API Documentation
- Jest
- Supertest
- Manual browser testing
- OpenAPI/Swagger
- Postman

### Development and Version Control
- Git
- GitHub
- Environment-based configuration
- GitHub Issues and Pull Requests

*The team will finalize the detailed architecture, development conventions, and implementation decisions during the design phase.*

## Scope and Limitations

The initial implementation will focus on the core missing-mark reporting, tracking, attendance, and case-management workflows.

The project will use local or mock academic data during development rather than assuming access to live university systems.

The application will not directly modify official university examination results or replace institutional examination registers.

The following are outside the initial scope:

- Direct integration with live university systems.
- SMS notifications.
- AI-based academic decision-making.
- Payment processing.
- Dedicated native Android or iOS applications.
- Real-time dashboard updates.
- Cloud-based file storage.
- Automated database backups.

These limitations help keep the project manageable within the planned development period.

## Repository Structure

The repository will evolve as requirements are finalized and implementation progresses.

```text
missing-marks-management-system/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── backend/
├── frontend/
├── docs/
│   ├── requirements/
│   ├── design/
│   ├── architecture/
│   ├── api/
│   └── meeting-notes/
├── tests/
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Development Methodology

The team will develop the system incrementally, using Git and GitHub to coordinate implementation, review changes, and track progress.

The planned development phases are:

1. Requirements review and finalization.
2. System analysis and architecture design.
3. Database design and API contract definition.
4. Repository setup and development environment configuration.
5. Authentication and role-based access control.
6. Attendance management and assessment workflows.
7. Missing-mark reporting and case management.
8. Dashboards, notifications, and reporting.
9. Integration, testing, and security review.
10. Documentation, demonstration, and final presentation.

The order and timing of individual tasks may be adjusted as the team finalizes the design and implementation plan.

## Team Collaboration

All contributors are expected to:

- Work through assigned GitHub Issues.
- Use feature branches instead of committing directly to the main branch.
- Submit Pull Requests for review before merging changes.
- Write clear and descriptive commit messages.
- Test changes before submitting Pull Requests.
- Update relevant documentation when requirements or implementation decisions change.
- Avoid committing credentials, passwords, tokens, or other sensitive information.
- Communicate blockers and coordinate changes that affect other modules.

Detailed contribution guidelines will be maintained in `CONTRIBUTING.md`.

## Security and Data Protection

The project will follow security-conscious development practices, including:

- Authentication and role-based authorization.
- Server-side input validation.
- Secure password hashing.
- Protected handling of uploaded documents.
- Server-side attendance and eligibility validation.
- Audit logging for important actions.
- Restricted access to student records.
- Environment-based configuration for secrets.

Development and demonstration activities will use local or mock academic data unless authorized data access is formally established.

## Project Status

**Current stage: Planning and Requirements Finalization**

The team is preparing the repository, reviewing the requirements, defining system architecture, and organizing the initial development workflow.

Implementation progress, design decisions, and completed features will be documented as development proceeds.

## Future Enhancements

Potential future improvements include:

- Approved integration with university systems.
- Cloud-based document storage.
- Automated database backups.
- Real-time notifications and dashboard updates.
- A dedicated mobile application.
- Expanded analytics and reporting.

These enhancements will be considered after the initial scope has been addressed.

## Academic Project

**Institution:** Kisii University

**Project Type:** University Software Engineering Project

**Platform:** Responsive Web Application

**Team Size:** Four members

**Target Implementation Period:** Approximately two months

## License

The project's license will be selected and documented by the team.

---

**Contributions:** Team members should use the repository's Issues and Pull Requests to coordinate development and document important decisions.
