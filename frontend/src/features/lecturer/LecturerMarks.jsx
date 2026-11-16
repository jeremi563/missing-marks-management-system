import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getLecturerAssessmentRoster,
  getLecturerMarkOptions,
  submitLecturerMarks,
} from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

export default function LecturerMarks() {
  const [options, setOptions] = useState([])
  const [courseUnitId, setCourseUnitId] = useState('')
  const [academicPeriodId, setAcademicPeriodId] = useState('')
  const [assessmentId, setAssessmentId] = useState('')
  const [roster, setRoster] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    getLecturerMarkOptions()
      .then((response) => { if (active) setOptions(extractRecords(response)) })
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load mark entry options.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const selectedUnit = options.find(({ courseUnit }) => courseUnit.id === courseUnitId)
  const periods = selectedUnit?.academicPeriods ?? []
  const assessments = selectedUnit?.courseUnit.assessments ?? []
  const selectedAssessment = assessments.find(({ id }) => id === assessmentId)
  const canLoadRoster = Boolean(selectedUnit && academicPeriodId && selectedAssessment)

  const loadRoster = useCallback(async () => {
    if (!canLoadRoster) return
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const response = await getLecturerAssessmentRoster(assessmentId, academicPeriodId)
      setRoster(unwrap(response))
      setDrafts({})
    } catch (requestError) {
      setRoster(null)
      setError(requestError.userMessage || 'Unable to load this assessment roster.')
    } finally {
      setLoading(false)
    }
  }, [assessmentId, academicPeriodId, canLoadRoster])

  useEffect(() => {
    if (!canLoadRoster) {
      setRoster(null)
      return
    }
    loadRoster()
  }, [canLoadRoster, loadRoster])

  const markableStudents = useMemo(
    () => roster?.students?.filter(({ mark }) => !mark) ?? [],
    [roster],
  )

  const submit = async (event) => {
    event.preventDefault()
    const marks = markableStudents
      .filter(({ student }) => drafts[student.id] !== undefined && drafts[student.id] !== '')
      .map(({ student }) => ({ studentProfileId: student.id, value: Number(drafts[student.id]) }))
    if (!marks.length) {
      setError('Enter at least one mark before submitting.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await submitLecturerMarks(assessmentId, { academicPeriodId, marks })
      setNotice(`${marks.length} official mark${marks.length === 1 ? '' : 's'} submitted.`)
      await loadRoster()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to submit marks.')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !options.length) return <LoadingState message="Loading mark entry options…" />

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LECTURER PORTAL</p>
          <h2>Assessment marks</h2>
          <p>Submit initial marks for students enrolled in your assigned course units.</p>
        </div>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
      {loading && !options.length
        ? <LoadingState message="Loading mark entry options…" />
        : !options.length
          ? <EmptyState title="No assigned assessments" message="Active course-unit assignments with academic periods will appear here." />
          : (
            <section className="panel">
              <div className="form-grid">
                <label>Course unit
                  <select value={courseUnitId} onChange={(event) => { setCourseUnitId(event.target.value); setAcademicPeriodId(''); setAssessmentId('') }}>
                    <option value="">Select a course unit</option>
                    {options.map(({ courseUnit }) => <option key={courseUnit.id} value={courseUnit.id}>{courseUnit.code} · {courseUnit.name}</option>)}
                  </select>
                </label>
                <label>Academic period
                  <select value={academicPeriodId} disabled={!selectedUnit} onChange={(event) => setAcademicPeriodId(event.target.value)}>
                    <option value="">Select an academic period</option>
                    {periods.map((period) => <option key={period.id} value={period.id}>{period.name} · {period.academicYear}</option>)}
                  </select>
                </label>
                <label>Assessment
                  <select value={assessmentId} disabled={!selectedUnit} onChange={(event) => setAssessmentId(event.target.value)}>
                    <option value="">Select an assessment</option>
                    {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.code || assessment.name} · max {assessment.maximumMarks ?? 'not set'}</option>)}
                  </select>
                </label>
              </div>
              {loading && canLoadRoster
                ? <LoadingState message="Loading enrolled students…" />
                : roster && (
                  <form onSubmit={submit}>
                    <p>{roster.assessment.name} · {roster.academicPeriod.name} · Maximum {roster.assessment.maximumMarks}</p>
                    {roster.students.length === 0
                      ? <EmptyState title="No enrolled students" message="There are no enrollments for this assessment and period." />
                      : (
                        <>
                          <div className="table-wrap">
                            <table>
                              <thead><tr><th>Student</th><th>Student number</th><th>Official mark</th><th>Initial mark</th></tr></thead>
                              <tbody>
                                {roster.students.map(({ student, mark }) => (
                                  <tr key={student.id}>
                                    <td>{student.user?.displayName || 'Student'}</td>
                                    <td>{student.studentNumber}</td>
                                    <td>{mark ? mark.value : '—'}</td>
                                    <td>
                                      {mark
                                        ? <span>Submitted</span>
                                        : <input aria-label={`Initial mark for ${student.studentNumber}`} type="number" min="0" max={roster.assessment.maximumMarks} step="0.01" value={drafts[student.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [student.id]: event.target.value }))} />}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {markableStudents.length > 0 && <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit initial marks'}</button>}
                        </>
                      )}
                  </form>
                )}
            </section>
          )}
    </section>
  )
}
