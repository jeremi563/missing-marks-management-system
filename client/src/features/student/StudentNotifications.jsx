

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
  markStudentNotificationAsRead,
} from '../../api/student'
import '../../styles/StudentNotifications.css'

function StudentNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [refreshKey, setRefreshKey] = useState(0)

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
  }, [loadNotifications, refreshKey])

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markStudentNotificationAsRead(notificationId)

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification
        )
      )
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Failed to update notification.'
      )
    }
  }

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(
      (notification) => !notification.isRead
    )

    const failedNotifications = []

    for (const notification of unreadNotifications) {
      try {
        await markStudentNotificationAsRead(notification.id)
      } catch (err) {
        failedNotifications.push({
          id: notification.id,
          message:
            err.response?.data?.message ||
            'Unable to mark this notification as read.',
        })
      }
    }

    if (failedNotifications.length > 0) {
      setError(
        `${failedNotifications.length} notification(s) could not be marked as read.`
      )
    }

    setLoading(true)
    setRefreshKey((key) => key + 1)
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'UNREAD') return !notification.isRead
    if (filter === 'READ') return notification.isRead
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
          disabled={unreadCount === 0}
        >
          <CheckCheck size={17} />
          Mark all as read
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
                notification.isRead ? 'read' : 'unread'
              }`}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>

              <div className="notification-content">
                <div className="notification-title-row">
                  <h3>{notification.title || 'Notification'}</h3>

                  {!notification.isRead && (
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

              {!notification.isRead && (
                <button
                  className="mark-read-button"
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
