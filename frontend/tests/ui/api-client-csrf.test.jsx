import { expect, it } from 'vitest'
import apiClient from '../../src/api/client'

it('fetches and attaches a CSRF token to unsafe API requests', async () => {
  const originalAdapter = apiClient.defaults.adapter
  const requests = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    return {
      data: {
        success: true,
        data: {
          token: 'signed-csrf-token',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }

  try {
    await apiClient.post('/auth/login', { identifier: 'student', password: 'password' })
    const tokenRequest = requests.find(({ url }) => url === '/auth/csrf')
    const mutationRequest = requests.find(({ url }) => url === '/auth/login')

    expect(tokenRequest?.method).toBe('get')
    expect(mutationRequest?.headers.get('X-CSRF-Token')).toBe('signed-csrf-token')
  } finally {
    apiClient.defaults.adapter = originalAdapter
  }
})
