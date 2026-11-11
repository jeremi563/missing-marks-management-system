
import apiClient from './client'

export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials)
  return response.data
}

export const registerUser = async (registration) => {
  const response = await apiClient.post('/auth/register', registration)
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