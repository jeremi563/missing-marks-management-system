
import apiClient from './client'

export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials)
  return response.data
}

export const registerUser = async (registration) => {
  const response = await apiClient.post('/auth/register', registration)
  return response.data
}

export const getRegistrationDepartments = async () => {
  const response = await apiClient.get('/auth/departments')
  return response.data
}

export const registerLecturerDepartment = async (registration) => {
  const response = await apiClient.post('/auth/register-department', registration)
  return response.data
}

export const logoutUser = async () => {
  const response = await apiClient.post('/auth/logout')
  return response.data
}

export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me')
  return response.data
}

export const verifyEmail = async (token) => {
  const response = await apiClient.post('/auth/verify-email', { token })
  return response.data
}

export const resendVerification = async (email) => {
  const response = await apiClient.post('/auth/resend-verification', { email })
  return response.data
}

export const requestPasswordReset = async (email) => {
  const response = await apiClient.post('/auth/forgot-password', { email })
  return response.data
}

export const resetPassword = async (token, password) => {
  const response = await apiClient.post('/auth/reset-password', { token, password })
  return response.data
}

export const changePassword = async (currentPassword, newPassword) => {
  const response = await apiClient.post('/auth/change-password', { currentPassword, newPassword })
  return response.data
}