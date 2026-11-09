
import { createContext, useEffect, useState } from 'react'
import {
  loginUser,
  logoutUser,
  getCurrentUser,
} from '../api/auth'

export const AuthContext = createContext(null)

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
          setUser(response.data)
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

  try {
    await loginUser(credentials)

    const response = await getCurrentUser()
    setUser(response.data)

    return response.data
  } catch (error) {
    throw error
  }
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