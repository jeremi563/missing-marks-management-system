import { useEffect, useState } from 'react'
import { AlertCircle, Bell, CheckCheck, CheckCircle, Clock, Info } from 'lucide-react'
import {
  getLecturerNotifications,
  markAllLecturerNotificationsRead,
  markLecturerNotificationRead,
} from '../../api/lecturer'
import {
  getCodNotifications,
  markAllCodNotificationsRead,
  markCodNotificationRead,
} from '../../api/cod'
import './StaffNotifications.css'

const PAGE_SIZE = 20

function getResult(response) {
  return response?.data?.data ?? response?.data ?? response
}

function StaffNotifications({ audience }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const getNotifications = audience === 'lecturer' ? getLecturerNotifications : getCodNotifications
  const markNotificationRead = audience === 'lecturer' ? markLecturerNotificationRead : markCodNotificationRead
  const markAllNotificationsRead = audience === 'lecturer' ? markAllLecturerNotificationsRead : markAllCodNotificationsRead

  useEffect(() => {
    let active = true
    getNotifications({ page, limit: PAGE_SIZE, status: filter })
      .then((response) => {
        if (!active) return
        const result = getResult(response)
        setNotifications(result?.notifications ?? [])
        setUnreadCount(result?.unreadCount ?? 0)
        setPagination(result?.pagination ?? { page, totalPages: 1 })
        setError('')
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Failed to load notifications.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [filter, getNotifications, page, refreshKey])

  const handleMarkRead = async (id) => {
    setSaving(true)
    try {
      await markNotificationRead(id)
      setRefreshKey((key) => key + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notification.')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAllRead = async () => {
    setSaving(true)
    try {
      await markAllNotificationsRead()
      setRefreshKey((key) => key + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark notifications as read.')
    } finally {
      setSaving(false)
    }
  }

  const getIcon = (title = '') => {
    const value = title.toLowerCase()
    if (value.includes('approved') || value.includes('completed')) return <CheckCircle size={20} />
    if (value.includes('rejected') || value.includes('failed')) return <AlertCircle size={20} />
    return <Info size={20} />
  }

  return (
    <main className="staff-notifications">
      <header className="staff-notifications__header">
        <div>
          <p className="staff-notifications__eyebrow">{audience === 'cod' ? 'Department workspace' : 'Lecturer workspace'}</p>
          <h1>Notifications</h1>
          <p>Updates about missing-mark reports and your department workflow.</p>
        </div>
        <div className="staff-notifications__count"><Bell size={18} /> {unreadCount} unread</div>
      </header>

      {error && <div className="staff-notifications__error" role="alert">{error}</div>}

      <div className="staff-notifications__toolbar">
        <div className="staff-notifications__filters" aria-label="Filter notifications">
          {['all', 'unread', 'read'].map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'is-active' : ''}
              onClick={() => {
                if (value !== filter || page !== 1) setLoading(true)
                setPage(1)
                setFilter(value)
              }}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="staff-notifications__mark-all"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || saving}
        >
          <CheckCheck size={17} /> Mark all as read
        </button>
      </div>

      {loading ? (
        <div className="staff-notifications__empty">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="staff-notifications__empty">
          <Bell size={30} />
          <h2>No notifications here</h2>
          <p>{filter === 'unread' ? 'You are all caught up.' : 'New report and workflow updates will appear here.'}</p>
        </div>
      ) : (
        <div className="staff-notifications__list">
          {notifications.map((notification) => {
            const isRead = Boolean(notification.readAt)
            return (
              <article key={notification.id} className={`staff-notifications__item ${isRead ? 'is-read' : 'is-unread'}`}>
                <div className="staff-notifications__icon">{getIcon(notification.title)}</div>
                <div className="staff-notifications__body">
                  <div className="staff-notifications__title">
                    <h2>{notification.title || 'Notification'}</h2>
                    {!isRead && <span>New</span>}
                  </div>
                  <p>{notification.message}</p>
                  <div className="staff-notifications__meta">
                    <Clock size={14} />
                    <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                    {notification.report?.reference && <span>Report {notification.report.reference}</span>}
                  </div>
                </div>
                {!isRead && (
                  <button
                    type="button"
                    className="staff-notifications__mark-one"
                    disabled={saving}
                    onClick={() => handleMarkRead(notification.id)}
                  >
                    Mark as read
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <nav className="staff-notifications__pagination" aria-label="Notification pages">
          <button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>Previous</button>
          <span>Page {page} of {pagination.totalPages}</span>
          <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Next</button>
        </nav>
      )}
    </main>
  )
}

export default StaffNotifications
