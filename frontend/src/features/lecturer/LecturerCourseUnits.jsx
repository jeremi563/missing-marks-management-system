import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getLecturerCourseUnits } from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'

export default function LecturerCourseUnits() {
  const [courseUnits, setCourseUnits] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    getLecturerCourseUnits()
      .then((response) => {
        if (!active) return
        setCourseUnits(extractRecords(response))
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || 'Unable to load your assigned course units.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [refresh])

  const retry = () => {
    setError('')
    setLoading(true)
    setRefresh((value) => value + 1)
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LECTURER PORTAL</p>
          <h2>My course units</h2>
          <p>Course units delegated to you by your department CODs.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={retry}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {loading ? <LoadingState message="Loading your course units…" /> :
        error ? <ErrorState title="Unable to load course units" message={error} onRetry={retry} /> :
          courseUnits.length === 0 ? (
            <EmptyState title="No course units assigned" message="Course units delegated to you by your COD will appear here." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Course unit</th><th>Department</th><th>Assigned</th></tr>
                </thead>
                <tbody>
                  {courseUnits.map(({ id, courseUnit, createdAt }) => (
                    <tr key={id}>
                      <td><strong>{courseUnit.code}</strong><br />{courseUnit.name}</td>
                      <td>{courseUnit.department.name}{courseUnit.department.code ? ` (${courseUnit.department.code})` : ''}</td>
                      <td>{createdAt ? new Date(createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </section>
  )
}
