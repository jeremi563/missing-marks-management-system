

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

// Attendance
export const getStudentAttendance = async (params = {}) => {
  const response = await apiClient.get('/student/attendance', { params })
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
