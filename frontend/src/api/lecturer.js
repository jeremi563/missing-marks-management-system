import apiClient from './client'
import { withEvidenceFiles } from './evidence'

const request = async (method, url, data, config) => {
  const response = await apiClient.request({ method, url, data, ...config })
  return response.data
}

export const getLecturerReports = (params = {}) => request('get', '/lecturer/reports', undefined, { params })
export const getLecturerCourseUnits = () => request('get', '/lecturer/course-units')
export const getLecturerCourseUnitAssessments = (courseUnitId, type) => request('get', `/lecturer/course-units/${courseUnitId}/assessments`, undefined, { params: { type } })
export const getLecturerCatSubmissions = (params = {}) => request('get', '/lecturer/cat-submissions', undefined, { params })
export const getLecturerCatSubmission = (submissionId) => request('get', `/lecturer/cat-submissions/${submissionId}`)
export const decideLecturerCatSubmission = (submissionId, decision) => request('post', `/lecturer/cat-submissions/${submissionId}/decision`, decision)
export const decideLecturerCatSubmissions = (decision) => request('post', '/lecturer/cat-submissions/bulk-decision', decision)
export const getLecturerExamAttendance = (params = {}) => request('get', '/lecturer/exam-attendance', undefined, { params })
export const getLecturerExamAttendanceRecord = (recordId) => request('get', `/lecturer/exam-attendance/${recordId}`)
export const decideLecturerExamAttendance = (recordId, decision) => request('post', `/lecturer/exam-attendance/${recordId}/decision`, decision)
export const decideLecturerExamAttendanceRecords = (decision) => request('post', '/lecturer/exam-attendance/bulk-decision', decision)
export const getLecturerClassrooms = () => request('get', '/lecturer/classrooms')
export const getLecturerStudents = (params = {}) => request('get', '/lecturer/students', undefined, { params })
export const getLecturerDepartments = () => request('get', '/lecturer/departments')
export const getLecturerNotifications = (params = {}) => request('get', '/lecturer/notifications', undefined, { params })
export const markLecturerNotificationRead = (id) => request('patch', `/lecturer/notifications/${id}/read`)
export const markAllLecturerNotificationsRead = () => request('patch', '/lecturer/notifications/read-all')
export const getLecturerEnrollmentRequests = (params = {}) => request('get', '/lecturer/enrollment-requests', undefined, { params })
export const decideLecturerEnrollmentRequests = (data) => request('post', '/lecturer/enrollment-requests/decision', data)
export const getLecturerReport = (reportId) => request('get', `/lecturer/reports/${reportId}`)
export const getLecturerReportComments = (reportId) => request('get', `/lecturer/reports/${reportId}/comments`)
export const addLecturerReportComment = (reportId, body) => request('post', `/lecturer/reports/${reportId}/comments`, { body })
export const startLecturerReport = (reportId) => request('post', `/lecturer/reports/${reportId}/start`)
export const decideLecturerReport = (reportId, decision) => request('post', `/lecturer/reports/${reportId}/decision`, decision)
export const escalateLecturerReport = (reportId, data) => request('post', `/lecturer/reports/${reportId}/escalate`, data)
export const submitLecturerCorrection = (reportId, data) => request('post', `/lecturer/reports/${reportId}/corrections`, data)
export const getLecturerReportCorrections = (reportId) => request('get', `/lecturer/reports/${reportId}/corrections`)
export const getLecturerMarkOptions = () => request('get', '/lecturer/marks/options')
export const getLecturerAssessmentRoster = (assessmentId, academicPeriodId) => request('get', `/lecturer/assessments/${assessmentId}/marks`, undefined, { params: { academicPeriodId } })
export const submitLecturerMarks = (assessmentId, data) => request('post', `/lecturer/assessments/${assessmentId}/marks`, data)
export const createLecturerSpecialCase = (reportId, data, files = []) => {
  const payload = withEvidenceFiles(data, files)
  return request(
    'post',
    `/lecturer/reports/${reportId}/special-cases`,
    payload,
    payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  )
}
export const getLecturerSpecialCases = (params = {}) => request('get', '/lecturer/special-cases', undefined, { params })
export const getLecturerSpecialCase = (caseId) => request('get', `/lecturer/special-cases/${caseId}`)
export const recommendLecturerSpecialCase = (caseId, data) => request('post', `/lecturer/special-cases/${caseId}/recommendation`, data)
export const scheduleLecturerSpecialCase = (caseId, data) => request('post', `/lecturer/special-cases/${caseId}/schedule`, data)
export const rescheduleLecturerSpecialCase = (caseId, data) => request('post', `/lecturer/special-cases/${caseId}/reschedule`, data)
export const recordLecturerSpecialCaseAttendance = (caseId, data) => request('post', `/lecturer/special-cases/${caseId}/attendance`, data)
export const cancelLecturerSpecialCase = (caseId, reason) => request('post', `/lecturer/special-cases/${caseId}/cancel`, { reason })
export const getLecturerAssessmentTypes = () => request('get', '/lecturer/assessment-types')

export const getLecturerAttendanceSessions = (params = {}) => request('get', '/lecturer/attendance/sessions', undefined, { params })
export const getLecturerAttendanceSession = (sessionId) => request('get', `/lecturer/attendance/sessions/${sessionId}`)
export const createLecturerAttendanceSession = (data) => request('post', '/lecturer/attendance/sessions', data)
export const startLecturerAttendanceSession = (sessionId) => request('post', `/lecturer/attendance/sessions/${sessionId}/start`)
export const generateLecturerAttendanceLink = (sessionId) => request('post', `/lecturer/attendance/sessions/${sessionId}/attendance-link`)
export const extendLecturerAttendanceSession = (sessionId, endsAt) => request('patch', `/lecturer/attendance/sessions/${sessionId}/end-time`, { endsAt })
export const endLecturerAttendanceSession = (sessionId) => request('post', `/lecturer/attendance/sessions/${sessionId}/end`)
export const getLecturerAttendanceRecords = (sessionId) => request('get', `/lecturer/attendance/sessions/${sessionId}/records`)

export const allocateLecturerExamBooklets = (sessionId) => request('post', `/lecturer/exam-booklets/sessions/${sessionId}/allocate`)
export const previewLecturerExamBooklet = (sessionId, token) => request('post', `/lecturer/exam-booklets/sessions/${sessionId}/scan/preview`, { token })
export const scanLecturerExamBooklet = (sessionId, data) => request('post', `/lecturer/exam-booklets/sessions/${sessionId}/scan`, data)
export const manualLookupLecturerExamBooklet = (sessionId, data) => request('post', `/lecturer/exam-booklets/sessions/${sessionId}/manual-lookup`, data)
export const getLecturerExamBookletScans = (sessionId, params = {}) => request('get', `/lecturer/exam-booklets/sessions/${sessionId}/scans`, undefined, { params })
export const replaceLecturerExamBooklet = (bookletId, reason) => request('post', `/lecturer/exam-booklets/${bookletId}/replacements`, { reason })

export const getLecturerAttendanceDiscrepancies = (params = {}) => request('get', '/lecturer/attendance-discrepancies', undefined, { params })
export const getLecturerAttendanceDiscrepancy = (id) => request('get', `/lecturer/attendance-discrepancies/${id}`)
export const createLecturerAttendanceDiscrepancy = (data) => request('post', '/lecturer/attendance-discrepancies', data)
export const reviewLecturerAttendanceDiscrepancy = (id, data) => request('post', `/lecturer/attendance-discrepancies/${id}/review`, data)
export const clarifyLecturerAttendanceDiscrepancy = (id, body) => request('post', `/lecturer/attendance-discrepancies/${id}/clarifications`, { body })