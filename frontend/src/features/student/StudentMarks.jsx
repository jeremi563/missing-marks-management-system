import { useEffect, useMemo, useState } from 'react'
import { getStudentMarks } from '../../api/student'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords, formatMarkValue } from '../shared/recordUtils'

export default function StudentMarks() {
  const [marks, setMarks] = useState([])
  const [academicPeriodId, setAcademicPeriodId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getStudentMarks()
      .then((response) => { if (active) setMarks(extractRecords(response)) })
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load your marks.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const periods = useMemo(() => {
    const unique = new Map()
    marks.forEach(({ enrollment }) => unique.set(enrollment.academicPeriod.id, enrollment.academicPeriod))
    return [...unique.values()].sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
  }, [marks])
  const visibleMarks = marks.filter(({ enrollment }) => !academicPeriodId || enrollment.academicPeriod.id === academicPeriodId)

  return (
    <section>
      <header className="page-heading">
        <div><p className="eyebrow">STUDENT PORTAL</p><h2>My marks</h2><p>Official marks recorded for your enrolled assessments.</p></div>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <section className="panel">
        <label>Academic period
          <select value={academicPeriodId} onChange={(event) => setAcademicPeriodId(event.target.value)} disabled={loading || !periods.length}>
            <option value="">All periods</option>
            {periods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.code ? ` (${period.code})` : ''}</option>)}
          </select>
        </label>
        {loading
          ? <LoadingState message="Loading your marks…" />
          : error
            ? <ErrorState title="Marks unavailable" message={error} />
            : visibleMarks.length === 0
              ? <EmptyState title="No official marks" message={academicPeriodId ? 'No marks are recorded for this academic period.' : 'Official marks will appear here when recorded.'} />
              : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Course unit</th><th>Assessment</th><th>Academic period</th><th>Mark</th><th>Maximum</th></tr></thead>
                    <tbody>
                      {visibleMarks.map((mark) => (
                        <tr key={mark.id}>
                          <td>{mark.assessment.courseUnit.code} · {mark.assessment.courseUnit.name}</td>
                          <td>{mark.assessment.code ? `${mark.assessment.code} · ` : ''}{mark.assessment.name} ({mark.assessment.type})</td>
                          <td>{mark.enrollment.academicPeriod.name}</td>
                          <td><strong>{formatMarkValue(mark.value)}</strong></td>
                          <td>{mark.assessment.maximumMarks ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      </section>
    </section>
  )
}
