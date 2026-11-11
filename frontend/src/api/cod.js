import apiClient from './client'

const request = async (method, url, data, config) => {
  const response = await apiClient.request({ method, url, data, ...config })
  return response.data
}

export const getCodReports = (params = {}) => request('get', '/cod/reports', undefined, { params })
export const getCodReport = (reportId) => request('get', `/cod/reports/${reportId}`)
export const getCodReportComments = (reportId) => request('get', `/cod/reports/${reportId}/comments`)
export const addCodReportComment = (reportId, body) => request('post', `/cod/reports/${reportId}/comments`, { body })
export const getCodEligibleLecturers = (reportId) => request('get', `/cod/reports/${reportId}/eligible-lecturers`)
export const assignCodReport = (reportId, data) => request('post', `/cod/reports/${reportId}/assign`, data)
export const decideCodReport = (reportId, data) => request('post', `/cod/reports/${reportId}/decision`, data)
export const getPendingLecturerApprovals = () => request('get', '/cod/pending-lecturer-approvals')
export const decideLecturerApproval = (id, status) => request('patch', `/cod/lecturer-approvals/${id}`, { status })

export const getCodAppeals = (params = {}) => request('get', '/cod/appeals', undefined, { params })
export const getCodAppeal = (appealId) => request('get', `/cod/appeals/${appealId}`)
export const decideCodAppeal = (appealId, data) => request('post', `/cod/appeals/${appealId}/decision`, data)
export const getCodSpecialCases = (params = {}) => request('get', '/cod/special-cases', undefined, { params })
export const getCodSpecialCase = (caseId) => request('get', `/cod/special-cases/${caseId}`)
export const decideCodSpecialCase = (caseId, data) => request('post', `/cod/special-cases/${caseId}/decision`, data)
export const getCodSpecialCaseCategories = () => request('get', '/cod/special-case-categories')
export const createCodSpecialCaseCategory = (data) => request('post', '/cod/special-case-categories', data)
export const updateCodSpecialCaseCategory = (id, data) => request('patch', `/cod/special-case-categories/${id}`, data)
export const getCodOverdueReports = (params = {}) => request('get', '/cod/reports/overdue', undefined, { params })
export const getCodOverdueAppeals = (params = {}) => request('get', '/cod/appeals/overdue', undefined, { params })
export const getCodOverdueCases = (params = {}) => request('get', '/cod/special-cases/overdue', undefined, { params })

export const getCodAttendanceRecords = (params = {}) => request('get', '/cod/attendance-records', undefined, { params })
export const getCodAssessmentAttendance = (params = {}) => request('get', '/cod/assessment-attendance', undefined, { params })
export const getCodAttendanceAttempts = (params = {}) => request('get', '/cod/attendance-attempts', undefined, { params })
export const getCodAttendanceRecordHistory = (id) => request('get', `/cod/attendance-records/${id}/history`)
export const getCodAttendanceDiscrepancyAudit = (id) => request('get', `/cod/attendance-discrepancies/${id}/audit`)
export const getCodAttendanceSummary = (params = {}) => request('get', '/cod/attendance-summary', undefined, { params })
export const getCodAttendanceStatistics = (params = {}) => request('get', '/cod/attendance-statistics', undefined, { params })
export const getCodAttendanceDiscrepancies = (params = {}) => request('get', '/cod/attendance-discrepancies', undefined, { params })
export const getCodAttendanceDiscrepancy = (id) => request('get', `/cod/attendance-discrepancies/${id}`)
export const getCodAttendanceDiscrepancyDecisions = (id) => request('get', `/cod/attendance-discrepancies/${id}/decisions`)
export const decideCodAttendanceDiscrepancy = (id, data) => request('post', `/cod/attendance-discrepancies/${id}/decisions`, data)
export const revalidateLegacyAttendance = (id, data) => request('post', `/cod/attendance-discrepancies/${id}/revalidate-legacy-authorization`, data)