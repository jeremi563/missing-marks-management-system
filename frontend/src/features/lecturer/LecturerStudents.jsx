import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getLecturerStudents } from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import Pager from '../../components/ui/Pager'
import { extractRecords } from '../shared/recordUtils'

const PAGE_SIZE = 20

export default function LecturerStudents() {
  const [students, setStudents] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    getLecturerStudents({ page, limit: PAGE_SIZE })
      .then((response) => {
        if (!active) return
        setStudents(extractRecords(response))
        setPagination(response?.pagination ?? { page, totalPages: 1, total: 0 })
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || 'Unable to load students in your course units.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [page, refresh])

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
          <h2>My students</h2>
          <p>Students enrolled in the course units assigned to you.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={retry}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      {!loading && !error && <p className="record-count">{pagination.total} enrollment(s) across your course units.</p>}
      {error && <div className="form-alert" role="alert">{error}</div>}
      {loading ? <LoadingState message="Loading your students…" /> :
        error ? <ErrorState title="Unable to load students" message={error} onRetry={retry} /> :
          students.length === 0 ? (
            <EmptyState title="No enrolled students" message="Students enrolled in your assigned course units will appear here." />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Student name</th><th>Registration number</th><th>Email</th><th>Course unit</th><th>Academic period</th></tr>
                  </thead>
                  <tbody>
                    {students.map(({ id, student, courseUnit, academicPeriod }) => (
                      <tr key={id}>
                        <td>{student.user?.displayName || '—'}</td>
                        <td>{student.studentNumber}</td>
                        <td>{student.officialEmail || student.user?.email || '—'}</td>
                        <td><strong>{courseUnit.code}</strong><br />{courseUnit.name}</td>
                        <td>{academicPeriod.code || academicPeriod.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && <Pager page={page} totalPages={pagination.totalPages} onChange={setPage} />}
            </>
          )}
    </section>
  )
}
