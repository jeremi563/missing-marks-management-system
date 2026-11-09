import axios from 'axios'
import { getApiErrorMessage } from './errorHandler'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Centralized response error handling.
apiClient.interceptors.response.use(
  (response) => response,

  (error) => {
    error.userMessage = getApiErrorMessage(error)

    return Promise.reject(error)
  }
)

export default apiClient