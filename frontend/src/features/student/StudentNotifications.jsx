

import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  CheckCheck,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react'
import {
  getStudentNotifications,
  markAllStudentNotificationsAsRead,
  markStudentNotificationAsRead,
} from '../../api/student'

function isNotificationRead(notification) {
  return Boolean(notification.readAt ?? notification.isRead)
}

function StudentNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [saving, setSaving] = useState(false)

  const loadNotifications = useCallback(async () => {
    const response = await getStudentNotifications()
    const result = response?.data ?? response
    const data = result?.data ?? result

    return Array.isArray(data)
      ? data
      : data?.notifications || data?.items || []
  }, [])

  useEffect(() => {
    let isCurrent = true

    const load = async () => {
      try {
        const data = await loadNotifications()

        if (isCurrent) {
          setNotifications(data)
          setError('')
        }
      } catch (err) {
        if (isCurrent) {
          setError(
            err.response?.data?.message ||
            'Failed to load notifications.'
          )
        }
      } finally {
        if (isCurrent) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      isCurrent = false
    }
  }, [loadNotifications])

  const handleMarkAsRead = async (notificationId) => {
    setSaving(true)
    setError('')
    try {
      await markStudentNotificationAsRead(notificationId)

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true, readAt: notification.readAt || new Date().toISOString() }
            : notification
        )
      )
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to update notification.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAllAsRead = async () => {
    setSaving(true)
    setError('')
    try {
      await markAllStudentNotificationsAsRead()
      const readAt = new Date().toISOString()
      setNotifications((previous) => previous.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || readAt,
      })))
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to mark notifications as read.'
      )
    } finally {
      setSaving(false)
    }
  }

  const unreadCount = notifications.filter(
    (notification) => !isNotificationRead(notification)
  ).length

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'UNREAD') return !isNotificationRead(notification)
    if (filter === 'READ') return isNotificationRead(notification)
    return true
  })

  const getNotificationIcon = (type) => {
    const value = type?.toLowerCase() || ''

    if (value.includes('success') || value.includes('approved')) {
      return <CheckCircle size={20} />
    }

    if (value.includes('error') || value.includes('rejected')) {
      return <AlertCircle size={20} />
    }

    return <Info size={20} />
  }

  const formatDate = (date) => {
    if (!date) return 'Date unavailable'

    return new Date(date).toLocaleString()
  }

  if (loading) {
    return (
      <div className="student-notifications">
        <div className="notifications-loading">
          Loading notifications...
        </div>
      </div>
    )
  }

  return (
    <div className="student-notifications">
      <div className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>Stay updated on your missing mark reports and other activities.</p>
        </div>

        <div className="notification-count">
          <Bell size={20} />
          <span>{unreadCount} unread</span>
        </div>
      </div>

      {error && (
        <div className="notifications-error">
          {error}
        </div>
      )}

      <div className="notifications-toolbar">
        <div className="notification-filters">
          {['ALL', 'UNREAD', 'READ'].map((option) => (
            <button
              key={option}
              className={filter === option ? 'active' : ''}
              onClick={() => setFilter(option)}
            >
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <button
          className="mark-all-button"
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0 || saving}
        >
          <CheckCheck size={17} />
          {saving ? 'Marking…' : 'Mark all as read'}
        </button>
      </div>

      <div className="notifications-list">
        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <Bell size={35} />
            <h3>No notifications found</h3>
            <p>
              {filter === 'UNREAD'
                ? 'You have no unread notifications.'
                : 'Your notifications will appear here.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-card ${
                isNotificationRead(notification) ? 'read' : 'unread'
              }`}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>

              <div className="notification-content">
                <div className="notification-title-row">
                  <h3>{notification.title || 'Notification'}</h3>

                  {!isNotificationRead(notification) && (
                    <span className="unread-indicator">
                      New
                    </span>
                  )}
                </div>

                <p>
                  {notification.message || notification.body}
                </p>

                <div className="notification-date">
                  <Clock size={14} />
                  <span>
                    {formatDate(
                      notification.createdAt || notification.created_at
                    )}
                  </span>
                </div>
              </div>

              {!isNotificationRead(notification) && (
                <button
                  className="mark-read-button"
                  disabled={saving}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  Mark as read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default StudentNotifications
