import { useEffect, useState } from 'react'
import { getCurrentUser, loginUser, logoutUser } from '../api/auth'
import { AuthContext } from './AuthContext'

function unwrapUser(response) {
  const data = response?.data ?? response
  return data?.user ?? data?.data?.user ?? data?.data ?? null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((response) => {
        if (active) setUser(unwrapUser(response))
      })
      .catch((error) => {
        if (!active || error.response?.status === 401) return
        setAuthError(error.userMessage || 'Unable to verify your session.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => { active = false }
  }, [])

  const login = async (credentials) => {
    setAuthError('')
    await loginUser(credentials)
    const authenticatedUser = unwrapUser(await getCurrentUser())
    setUser(authenticatedUser)
    return authenticatedUser
  }

  const logout = async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
      setAuthError('')
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      authError,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
