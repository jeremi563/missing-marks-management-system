# User Guide

Plain-language instructions for each role. Written for people using the application, not developers. **Draft:** sections are completed as features ship; the developer of each feature adds the matching steps (and screenshots when the frontend exists).

> The system uses practice (mock) data in this version. It does not change official university marks or records.

## Contents
1. [What is this system?](#1-what-is-this-system)
2. [Getting started (all users)](#2-getting-started-all-users)
3. [Students](#3-students)
4. [Lecturers](#4-lecturers)
5. [COD / Academic Officers](#5-cod--academic-officers)
6. [Administrators](#6-administrators)
7. [Understanding statuses](#7-understanding-statuses)
8. [FAQs](#8-faqs)
9. [Getting help](#9-getting-help)

---

## 1. What is this system?
A place to report a missing mark, follow what happens to it, and get a clear final decision. Lecturers and CODs use it to investigate and decide; administrators keep it running. Every step is recorded so you can see who did what and when.

## 2. Getting started (all users)
- **Open the site** and choose **Login** (students can also **Register**).
- **Passwords** need at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.
- **Too many wrong attempts** (5) locks the account for 30 minutes.
- **Log out** when you finish, especially on shared computers.
- **Forgot password** *(coming in a later release)*: enter your registration number; a reset link goes to your official university email.

## 3. Students

### 3.1 Register *(MVP)*
1. Choose **Register**.
2. Enter your registration number, an email address and a password.
3. Your registration number must exist in the university records held by the system. If not, contact your department.

### 3.2 Set your notification email *(MVP)*
Before your first report you need a notification email (any valid address). Updates about your cases are sent there and appear in the in-app notifications.

### 3.3 Report a missing mark *(MVP)*
1. Go to **My Reports → New report**.
2. Choose the **unit** (you must be enrolled), the assessment (if applicable), the academic year/semester and the year you took the unit.
3. Describe what is missing.
4. **Submit.** You get a reference like `MMR-2026-000001` and a notification.
- You cannot have two *active* reports for the same unit and assessment.
- A lecturer is assigned automatically when the unit has one; otherwise your case waits in a queue until the department assigns someone.

### 3.4 Track your report *(MVP)*
Open the report to see its status, timeline, comments, decisions and whether it is overdue. See [statuses](#7-understanding-statuses).

### 3.5 Edit or withdraw *(MVP)*
Only while the status is **Pending**. Once the lecturer starts review, the original report is locked. A withdrawn report can be resubmitted.

### 3.6 Appeal *(MVP)*
If a decision is rejected you may appeal **once** per case: give a reason (and extra information if you have it). The COD then makes the final decision.

### 3.7 Notifications *(MVP)*
The bell shows updates. Mark them read or unread as you like.

### 3.8 Attendance *(coming in a later release)*
Sign class or CAT attendance by opening the lecturer's link or scanning the QR code, signing in and allowing location access. See your attendance history on your dashboard. If something looks wrong, raise a **discrepancy** (no file upload needed). For examinations, scan the QR code in your booklet.
> A failed location check does **not** mark you absent. Tell your lecturer using a discrepancy request.

### 3.9 Special circumstances *(coming in a later release)*
Sickness, burial, special examination application, fee-related denial or other recognized circumstances: describe it and upload a supporting document (PDF, JPG, JPEG or PNG within the size limit). Staff review it; the system does not judge it.

## 4. Lecturers

### 4.1 Your case queue *(MVP)*
**Reports** lists cases assigned to you with filters (status, unit, date, student). Overdue cases are flagged.

### 4.2 Review a case *(MVP)*
1. Open the case and choose **Start review** (this locks the student's original report).
2. Read the details; add comments or ask for clarification.
3. **Approve** (goes to the COD) or **Reject** — a reason is required.
4. If a corrected mark is needed, enter the proposed mark; it cannot exceed the assessment maximum and needs COD approval.
Your comments can be edited until the COD starts review; after that they are fixed (you can still add new ones).

### 4.3 Attendance, CAT and exam tools *(coming in later releases)*
Create attendance sessions (link + QR), review discrepancies, verify CAT submissions, review exam attendance.

## 5. COD / Academic Officers

### 5.1 Department overview *(MVP)*
See all department cases, including unassigned ones. Assign or reassign a lecturer (a reason is recorded).

### 5.2 Decide cases and appeals *(MVP)*
Start COD review, read lecturer notes, and approve or reject with comments. Your decision closes the case or opens the appeal opportunity for the student. After closure the final decision is locked.

### 5.3 Escalated attendance discrepancies *(coming later)*

## 6. Administrators

### 6.1 Manage accounts and structure *(MVP)*
Create staff accounts, activate/deactivate users (their records are kept), and manage departments, units, enrollments and lecturer assignments.

### 6.2 Audit log *(MVP)*
Search who did what and when; filter by user, action, record and date.

### 6.3 Settings, maintenance, reopening, archives, exports *(coming later)*
Configure deadlines and limits, switch maintenance mode, reopen a closed case (reason required), view archived records (reason required), export PDF/Excel reports.

## 7. Understanding statuses

| Status | Meaning | What you can do |
|---|---|---|
| Pending | Submitted, waiting for the lecturer | Student: edit or withdraw |
| Under Review | Lecturer is investigating; report locked | Wait; reply if asked |
| Approved by Lecturer | Lecturer agrees; goes to COD | Wait |
| Rejected by Lecturer | Lecturer rejected with a reason | Student: appeal once or accept |
| Appealed | You submitted your appeal | Wait for COD |
| Under COD Review | COD is reviewing | Wait |
| Approved by COD | COD approved | Case closes |
| Rejected by COD | COD rejected | Student: appeal if not used, or accept |
| Resolved / Closed | Final decision recorded | View only |

**Overdue** is a flag shown next to a status when a deadline has passed; it doesn't change the status. A **withdrawn** report is shown as withdrawn in your list.

## 8. FAQs
**Why can't I submit another report for the same unit?** An active one already exists. Withdraw it (if still Pending) or wait until it's closed.
**Why can't I edit my report?** The lecturer has started review.
**Can I appeal twice?** No — one appeal per case.
**Does approval change my official marks?** No. Official marks are changed only by the university through its own processes.
**Who can see my report?** You, the assigned lecturer, the COD of the department, and administrators.
**Who can see my attendance history?** You; your lecturers and department COD within their scope; administrators.

## 9. Getting help
Check this guide and the in-app **Help** page first. If the problem remains, contact your department office or the system administrator. *(A support-ticket system is not part of this version.)*
