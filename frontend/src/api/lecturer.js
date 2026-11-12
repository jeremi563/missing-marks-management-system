import apiClient from './client'

const request = async (method, url, data, config) => {
  const response = await apiClient.request({ method, url, data, ...config })
  return response.data
}

export const getLecturerReports = (params = {}) => request('get', '/lecturer/reports', undefined, { params })
export const getLecturerCourseUnits = () => request('get', '/lecturer/course-units')
export const getLecturerCourseUnitAssessments = (courseUnitId, type) => request('get', `/lecturer/course-units/${courseUnitId}/assessments`, undefined, { params: { type } })
export const getLecturerStudents = (params = {}) => request('get', '/lecturer/students', undefined, { params })
export const getLecturerReport = (reportId) => request('get', `/lecturer/reports/${reportId}`)
export const getLecturerReportComments = (reportId) => request('get', `/lecturer/reports/${reportId}/comments`)
export const addLecturerReportComment = (reportId, body) => request('post', `/lecturer/reports/${reportId}/comments`, { body })
export const startLecturerReport = (reportId) => request('post', `/lecturer/reports/${reportId}/start`)
export const decideLecturerReport = (reportId, decision) => request('post', `/lecturer/reports/${reportId}/decision`, decision)
export const escalateLecturerReport = (reportId, data) => request('post', `/lecturer/reports/${reportId}/escalate`, data)
export const submitLecturerCorrection = (reportId, data) => request('post', `/lecturer/reports/${reportId}/corrections`, data)
export const createLecturerSpecialCase = (reportId, data) => request('post', `/lecturer/reports/${reportId}/special-cases`, data)
export const getLecturerSpecialCases = (params = {}) => request('get', '/lecturer/special-cases', undefined, { params })
export const getLecturerSpecialCase = (caseId) => request('get', `/lecturer/special-cases/${caseId}`)
export const getLecturerAssessmentTypes = () => request('get', '/lecturer/assessment-types')

export const getLecturerAttendanceSessions = (params = {}) => request('get', '/lecturer/attendance/sessions', undefined, { params })
export const getLecturerAttendanceSession = (sessionId) => request('get', `/lecturer/attendance/sessions/${sessionId}`)
export const createLecturerAttendanceSession = (data) => request('post', '/lecturer/attendance/sessions', data)
export const startLecturerAttendanceSession = (sessionId) => request('post', `/lecturer/attendance/sessions/${sessionId}/start`)
export const endLecturerAttendanceSession = (sessionId) => request('post', `/lecturer/attendance/sessions/${sessionId}/end`)
export const getLecturerAttendanceRecords = (sessionId) => request('get', `/lecturer/attendance/sessions/${sessionId}/records`)

export const getLecturerAttendanceDiscrepancies = (params = {}) => request('get', '/lecturer/attendance-discrepancies', undefined, { params })
export const getLecturerAttendanceDiscrepancy = (id) => request('get', `/lecturer/attendance-discrepancies/${id}`)
export const createLecturerAttendanceDiscrepancy = (data) => request('post', '/lecturer/attendance-discrepancies', data)
export const reviewLecturerAttendanceDiscrepancy = (id, data) => request('post', `/lecturer/attendance-discrepancies/${id}/review`, data)
export const clarifyLecturerAttendanceDiscrepancy = (id, body) => request('post', `/lecturer/attendance-discrepancies/${id}/clarifications`, { body })