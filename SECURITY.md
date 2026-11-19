# Security Policy

## Supported Versions

The project has no published security-support matrix or formally designated
supported releases. Until maintainers publish one, security reports may be
submitted for the current default branch. Support and security fixes for
older releases or independently deployed copies are not guaranteed.

## Reporting a Vulnerability

Please do not report suspected vulnerabilities in public issues, discussions,
pull requests, or other public channels. If GitHub's private vulnerability
reporting feature is enabled for this repository, use **Security → Report a
vulnerability** to send a private report to the maintainers.

If private vulnerability reporting is not enabled, do not post exploit details
publicly. Contact the repository maintainers through a private channel already
available to you, or use an appropriate university or institutional security
reporting channel. This policy does not publish an email address or guarantee
that a particular private channel is monitored.

Do not include real student records, passwords, access tokens, secret values,
or other confidential data in a report. Use synthetic data and redact
identifiers, request headers, logs, screenshots, and other evidence.

## Information Required in Security Reports

Include, to the extent safely available:

- A concise description of the suspected vulnerability and its potential
  security impact.
- The affected component, endpoint, workflow, and version or commit.
- Preconditions, affected role or account type, and a minimal reproduction
  using a local or otherwise authorized test environment and synthetic data.
- The expected behavior and the observed behavior.
- Any relevant sanitized logs, requests, or screenshots, with secrets and
  personal information removed.
- Whether the issue is known to affect a particular deployment or configuration.

Do not access, alter, retain, or disclose other people's data while
investigating or reporting.

## Vulnerability Validation and Response Process

Maintainers should, where feasible:

1. Acknowledge receipt privately and clarify any information needed to assess
   the report. No response-time commitment is made by this policy.
2. Reproduce and assess the issue in an authorized environment, determine
   affected components and data, and evaluate severity and scope.
3. Coordinate remediation and any necessary deployment or institutional
   response with the appropriate maintainers and stakeholders.
4. Communicate status and, when appropriate, coordinate a fix, security
   advisory, and public disclosure with the reporter.

Please do not interpret the absence of an immediate response as authorization
to test a live system or disclose the vulnerability publicly.

## Responsible Disclosure

Give maintainers a reasonable opportunity to investigate and address a valid
report before public disclosure. Coordinate the disclosure date and technical
details privately with them. Avoid exposing personal or academic information
and minimize any proof of concept to what is needed to demonstrate the issue.
Do not make threats, demand payment, or access data beyond what is necessary
to verify an issue.

## Security Scope

Reports are in scope when they demonstrate a security impact in this project
or a deployment operated by the project, including issues involving:

- Authentication, account registration and recovery, role-based access
  control, and authorization boundaries among students, lecturers, CODs /
  Academic Officers, and administrators.
- Student academic information, attendance records, examination marks,
  missing-marks reports and appeals, and mark-correction workflows.
- Department-level membership, assignments, review, and authorization.
- The PostgreSQL database and Prisma-backed data access, including
  confidentiality, integrity, or access-control failures.
- REST API endpoints, request handling, and input validation, including
  unauthorized object access or unsafe handling of uploaded evidence.
- Password storage and password-reset flows; session and token handling,
  including the application's JWT-based authentication.
- Environment variables, credentials, signing secrets, or other sensitive
  configuration.
- Audit-log creation, access, integrity, or disclosure.

The repository contains authentication and authorization middleware,
password hashing, request validation, and audit-log functionality. Their
presence does not guarantee that every route or workflow is correctly
protected. Reports should identify the specific affected behavior rather
than assume a security control exists or is comprehensive.

Only test systems and accounts that you own or are explicitly authorized to
assess. Prefer a local development environment with synthetic data. Do not
test against university or production systems without explicit permission
from their operator.

## Out-of-Scope Activities

The following are out of scope unless the affected system's operator has
provided explicit written authorization:

- Denial-of-service, resource exhaustion, load testing, or actions that
  disrupt availability.
- Social engineering, phishing, physical attacks, or attacks on accounts,
  systems, or infrastructure belonging to others.
- Accessing, downloading, changing, or sharing real student, staff, or other
  personal information; testing with real academic records.
- Testing third-party services, dependencies, or infrastructure where the
  issue is not demonstrably caused by this project.
- Spam, brute-force activity, automated high-volume scanning, or intrusive
  testing of a live deployment.
- Reports that describe best-practice concerns without a demonstrated
  security impact, or issues in versions for which support is not promised.
- Public disclosure of an unremediated vulnerability without prior
  coordination.
