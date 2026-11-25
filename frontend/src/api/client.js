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

const unsafeMethods = new Set(['post', 'put', 'patch', 'delete'])
let csrfTokenState
let csrfTokenRequest

async function getCsrfToken() {
  if (csrfTokenState && Date.now() < csrfTokenState.expiresAt - 30_000) {
    return csrfTokenState.token
  }

  if (!csrfTokenRequest) {
    csrfTokenRequest = apiClient.get('/auth/csrf')
      .then(({ data }) => {
        const tokenData = data?.data
        const expiresAt = Date.parse(tokenData?.expiresAt)
        if (!tokenData?.token || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          throw new Error('Unable to obtain a valid CSRF token')
        }
        csrfTokenState = { token: tokenData.token, expiresAt }
        return tokenData.token
      })
      .finally(() => {
        csrfTokenRequest = undefined
      })
  }

  return csrfTokenRequest
}

apiClient.interceptors.request.use(async (config) => {
  if (unsafeMethods.has(config.method?.toLowerCase())) {
    config.headers['X-CSRF-Token'] = await getCsrfToken()
  }
  return config
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