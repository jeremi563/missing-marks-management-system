

import apiClient from './client'

// Student profile
export const getStudentProfile = async () => {
  const response = await apiClient.get('/student/profile')
  return response.data
}

// Missing-mark reports
export const getStudentReports = async (params = {}) => {
  const response = await apiClient.get('/student/reports', { params })
  return response.data
}

export const getStudentReport = async (reportId) => {
  const response = await apiClient.get(`/student/reports/${reportId}`)
  return response.data
}

export const createStudentReport = async (reportData) => {
  const response = await apiClient.post('/student/reports', reportData)
  return response.data
}

// Report comments
export const getStudentReportComments = async (reportId) => {
  const response = await apiClient.get(
    `/student/reports/${reportId}/comments`
  )
  return response.data
}

export const addStudentReportComment = async (reportId, body) => {
  const response = await apiClient.post(
    `/student/reports/${reportId}/comments`,
    { body }
  )
  return response.data
}

// Report management
export const updateStudentReport = async (reportId, reportData) => {
  const response = await apiClient.patch(
    `/student/reports/${reportId}`,
    reportData
  )
  return response.data
}

export const withdrawStudentReport = async (reportId) => {
  const response = await apiClient.post(
    `/student/reports/${reportId}/withdraw`
  )
  return response.data
}

// Appeals
export const createStudentAppeal = async (reportId, appealData) => {
  const response = await apiClient.post(
    `/student/reports/${reportId}/appeals`,
    appealData
  )
  return response.data
}

export const getStudentAppeals = async (params = {}) => {
  const response = await apiClient.get('/student/appeals', { params })
  return response.data
}

export const getStudentAppeal = async (appealId) => {
  const response = await apiClient.get(`/student/appeals/${appealId}`)
  return response.data
}

export const createStudentSpecialCase = async (reportId, caseData) => {
  const response = await apiClient.post(`/student/reports/${reportId}/special-cases`, caseData)
  return response.data
}

export const getStudentSpecialCases = async (params = {}) => {
  const response = await apiClient.get('/student/special-cases', { params })
  return response.data
}

export const getStudentSpecialCase = async (caseId) => {
  const response = await apiClient.get(`/student/special-cases/${caseId}`)
  return response.data
}

// Attendance
export const getStudentAttendance = async (params = {}) => {
  const response = await apiClient.get('/student/attendance', { params })
  return response.data
}

export const getStudentAttendanceDiscrepancies = async (params = {}) => {
  const response = await apiClient.get('/student/attendance-discrepancies', { params })
  return response.data
}

export const createStudentAttendanceDiscrepancy = async (data) => {
  const response = await apiClient.post('/student/attendance-discrepancies', data)
  return response.data
}

export const getStudentAttendanceDiscrepancy = async (id) => {
  const response = await apiClient.get(`/student/attendance-discrepancies/${id}`)
  return response.data
}

export const respondToStudentAttendanceDiscrepancy = async (id, body) => {
  const response = await apiClient.post(`/student/attendance-discrepancies/${id}/clarifications`, { body })
  return response.data
}

// Notifications
export const getStudentNotifications = async (params = {}) => {
  const response = await apiClient.get('/student/notifications', { params })
  return response.data
}

export const markStudentNotificationAsRead = async (notificationId) => {
  const response = await apiClient.patch(
    `/student/notifications/${notificationId}/read`
  )
  return response.data
}
