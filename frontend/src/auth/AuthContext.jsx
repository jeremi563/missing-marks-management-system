import { useEffect, useState } from 'react'
import { extendSession as requestSessionExtension, getCurrentUser, loginUser, logoutUser } from '../api/auth'
import { AuthContext } from './AuthContext'

const SESSION_WARNING_BEFORE_EXPIRY_MS = 2 * 60 * 1000

function unwrapUser(response) {
  const data = response?.data ?? response
  return data?.user ?? data?.data?.user ?? data?.data ?? null
}

function unwrapSessionExpiresAt(response) {
  const data = response?.data ?? response
  return data?.sessionExpiresAt ?? data?.data?.sessionExpiresAt ?? null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const [isExtendingSession, setIsExtendingSession] = useState(false)
  const [sessionActionError, setSessionActionError] = useState('')

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((response) => {
        if (active) {
          setUser(unwrapUser(response))
          setSessionExpiresAt(unwrapSessionExpiresAt(response))
        }
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

  useEffect(() => {
    if (!user || !sessionExpiresAt) return undefined

    const expiresAt = Date.parse(sessionExpiresAt)
    if (!Number.isFinite(expiresAt)) return undefined

    const remaining = expiresAt - Date.now()
    const warningTimer = remaining > 0
      ? window.setTimeout(
        () => setShowSessionWarning(true),
        Math.max(0, remaining - SESSION_WARNING_BEFORE_EXPIRY_MS),
      )
      : null
    const expiryTimer = window.setTimeout(() => {
      setUser(null)
      setSessionExpiresAt(null)
      setShowSessionWarning(false)
    }, Math.max(0, remaining))

    return () => {
      if (warningTimer !== null) window.clearTimeout(warningTimer)
      window.clearTimeout(expiryTimer)
    }
  }, [user, sessionExpiresAt])

  const login = async (credentials) => {
    setAuthError('')
    const response = await loginUser(credentials)
    const currentUserResponse = await getCurrentUser()
    const authenticatedUser = unwrapUser(currentUserResponse)
    setUser(authenticatedUser)
    setSessionExpiresAt(unwrapSessionExpiresAt(currentUserResponse) || unwrapSessionExpiresAt(response))
    setShowSessionWarning(false)
    setSessionActionError('')
    return authenticatedUser
  }

  const refreshUser = async () => {
    const response = await getCurrentUser()
    const authenticatedUser = unwrapUser(response)
    setUser(authenticatedUser)
    setSessionExpiresAt(unwrapSessionExpiresAt(response))
    return authenticatedUser
  }

  const continueSession = async () => {
    setIsExtendingSession(true)
    setSessionActionError('')
    try {
      const response = await requestSessionExtension()
      const nextExpiry = unwrapSessionExpiresAt(response)
      if (!nextExpiry || !Number.isFinite(Date.parse(nextExpiry)) || Date.parse(nextExpiry) <= Date.now()) {
        throw new Error('The server returned an invalid session expiry.')
      }
      setSessionExpiresAt(nextExpiry)
      setShowSessionWarning(false)
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null)
        setSessionExpiresAt(null)
        setShowSessionWarning(false)
      } else {
        setSessionActionError(error.userMessage || 'Unable to extend your session. Please try again.')
      }
    } finally {
      setIsExtendingSession(false)
    }
  }

  const logout = async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
      setSessionExpiresAt(null)
      setShowSessionWarning(false)
      setAuthError('')
      setSessionActionError('')
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      authError,
      isAuthenticated: Boolean(user),
      login,
      refreshUser,
      logout,
    }}>
      {children}
      {showSessionWarning && user && (
        <div className="session-expiry-overlay">
          <section className="session-expiry-dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-expiry-title" aria-describedby="session-expiry-description">
            <h2 id="session-expiry-title">Your session is about to expire</h2>
            <p id="session-expiry-description">Extend your session now to stay signed in.</p>
            {sessionActionError && <p className="session-expiry-error" role="alert">{sessionActionError}</p>}
            <div className="session-expiry-actions">
              <button className="button button-secondary" type="button" onClick={() => logout().catch((error) => setSessionActionError(error.userMessage || 'Unable to sign out.'))}>
                Sign out
              </button>
              <button className="button button-primary" type="button" disabled={isExtendingSession} onClick={continueSession}>
                {isExtendingSession ? 'Extending…' : 'Stay signed in'}
              </button>
            </div>
          </section>
        </div>
      )}
    </AuthContext.Provider>
  )
}
