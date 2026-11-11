
import { useEffect, useState } from 'react'
import {
  loginUser,
  logoutUser,
  getCurrentUser,
} from '../api/auth'
import { AuthContext } from './AuthContext'

function getUserFromResponse(response) {
  return response?.data?.user ?? response?.user ?? response?.data ?? null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Restore an existing authenticated session.
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      try {
        const response = await getCurrentUser()

        if (isMounted) {
          setUser(getUserFromResponse(response))
          setAuthError(null)
        }
      } catch (error) {
        if (isMounted) {
          if (error.response?.status === 401) {
            setUser(null)
            setAuthError(null)
          } else {
            setAuthError(
              'Unable to verify your session. Please try again.'
            )
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  // Authenticate a user.
  const login = async (credentials) => {
    setAuthError(null)
    await loginUser(credentials)

    const response = await getCurrentUser()
    const authenticatedUser = getUserFromResponse(response)
    setUser(authenticatedUser)

    return authenticatedUser
  }

  // End the authenticated session.
  const logout = async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
      setAuthError(null)
    }
  }

  const value = {
    user,
    isLoading,
    authError,
    isAuthenticated: Boolean(user),
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}