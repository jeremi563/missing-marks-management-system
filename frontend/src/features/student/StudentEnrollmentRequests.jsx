import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCheck, Clock3, RefreshCw, Search, Send, X } from 'lucide-react'
import {
  getStudentEnrollmentOptions,
  submitStudentEnrollmentRequests,
} from '../../api/student'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import './StudentEnrollment.css'

function unwrapOptions(response) {
  const data = response?.data ?? response
  if (!data || !Array.isArray(data.courses) || !Array.isArray(data.academicPeriods)) {
    throw new Error('The server returned invalid enrollment options.')
  }
  return {
    courses: data.courses,
    academicPeriods: data.academicPeriods,
    enrollments: Array.isArray(data.enrollments) ? data.enrollments : [],
    requests: Array.isArray(data.requests) ? data.requests : [],
  }
}

export default function StudentEnrollmentRequests() {
  const [options, setOptions] = useState({ courses: [], academicPeriods: [], enrollments: [], requests: [] })
  const [periodId, setPeriodId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('courses')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    getStudentEnrollmentOptions()
      .then((response) => {
        const nextOptions = unwrapOptions(response)
        if (!active) return
        setOptions(nextOptions)
        setPeriodId((current) => current || nextOptions.academicPeriods[0]?.id || '')
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || requestError.message || 'Unable to load department courses.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [refresh])

  const selectedPeriod = options.academicPeriods.find(({ id }) => id === periodId)
  const periodEnrollments = useMemo(
    () => new Set(options.enrollments
      .filter(({ academicPeriodId }) => !periodId || academicPeriodId === periodId)
      .map(({ courseUnitId }) => courseUnitId)),
    [options.enrollments, periodId]
  )
  const enrolledPeriodLabels = useMemo(() => {
    const labels = new Map()
    options.enrollments.forEach(({ courseUnitId, academicPeriod }) => {
      if (!labels.has(courseUnitId)) labels.set(courseUnitId, new Set())
      labels.get(courseUnitId).add(academicPeriod?.code || academicPeriod?.name || 'Enrolled')
    })
    return labels
  }, [options.enrollments])
  const periodRequests = useMemo(
    () => new Map(options.requests.filter(({ academicPeriodId }) => academicPeriodId === periodId).map((request) => [request.courseUnitId, request])),
    [options.requests, periodId]
  )
  const visibleCourses = options.courses.filter((course) =>
    `${course.code} ${course.name}`.toLowerCase().includes(search.trim().toLowerCase())
  )
  const requestableCourses = visibleCourses.filter((course) =>
    course.lecturers.length > 0 &&
    !periodEnrollments.has(course.id) &&
    !['PENDING', 'APPROVED'].includes(periodRequests.get(course.id)?.status)
  )
  const pendingCount = options.requests.filter(({ status }) => status === 'PENDING').length

  const toggleCourse = (courseId) => {
    setSelectedIds((current) => current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId])
    setError('')
    setNotice('')
  }

  const toggleAllVisible = () => {
    const allSelected = requestableCourses.every(({ id }) => selectedIds.includes(id))
    setSelectedIds((current) => allSelected
      ? current.filter((id) => !requestableCourses.some(({ id: courseId }) => courseId === id))
      : [...new Set([...current, ...requestableCourses.map(({ id }) => id)])])
  }

  const submitRequests = async () => {
    if (!selectedPeriod || selectedIds.length === 0) return
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      await submitStudentEnrollmentRequests({ academicPeriodId: periodId, courseUnitIds: selectedIds })
      setSelectedIds([])
      setNotice(`${selectedIds.length} enrollment request${selectedIds.length === 1 ? '' : 's'} sent to the assigned lecturers and department COD.`)
      setActiveTab('requests')
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to submit your enrollment requests.')
    } finally {
      setSubmitting(false)
    }
  }

  const retry = () => {
    setLoading(true)
    setError('')
    setRefresh((value) => value + 1)
  }

  return (
    <section className="student-enrollment-page">
      <header className="page-heading student-enrollment-heading">
        <div>
          <p className="eyebrow">STUDENT PORTAL</p>
          <h2>Course enrollment</h2>
          <p>Choose the course units you are taking. Requests go to each course’s assigned lecturer and your department COD.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={retry}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      <div className="student-enrollment-tabs" role="tablist" aria-label="Course enrollment">
        <button type="button" role="tab" aria-selected={activeTab === 'courses'} className={activeTab === 'courses' ? 'active' : ''} onClick={() => setActiveTab('courses')}>
          Browse courses <span>{options.courses.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'requests'} className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}>
          My requests <span>{pendingCount ? `${pendingCount} pending` : options.requests.length}</span>
        </button>
      </div>

      {loading ? <LoadingState message="Loading department course units…" /> :
        error && options.courses.length === 0 ? <ErrorState title="Courses unavailable" message={error} onRetry={retry} /> :
          activeTab === 'courses' ? (
            <div className="student-enrollment-content">
              <section className="student-enrollment-toolbar">
                <div className="student-enrollment-period">
                  <label htmlFor="enrollment-period">Academic period</label>
                  <select id="enrollment-period" value={periodId} onChange={(event) => { setPeriodId(event.target.value); setSelectedIds([]) }} disabled={!options.academicPeriods.length}>
                    <option value="">{options.academicPeriods.length ? 'Select an academic period' : 'No enrollment windows are currently open'}</option>
                    {options.academicPeriods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.code ? ` · ${period.code}` : ''}</option>)}
                  </select>
                </div>
                <div className="student-enrollment-search">
                  <Search size={17} aria-hidden="true" />
                  <input aria-label="Search courses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search course units" />
                </div>
              </section>

              <div className="student-enrollment-list-heading">
                <div><h3>Department course units</h3>                <p>{selectedPeriod
                  ? `Select every course you are taking for ${selectedPeriod.name}.`
                  : options.academicPeriods.length
                    ? 'Select an academic period to request enrollment.'
                    : 'Enrollment is closed. Browse your department’s courses here; enrollment is limited to open windows.'}</p></div>
                <button className="link-button" type="button" disabled={!periodId || !requestableCourses.length} onClick={toggleAllVisible}>
                  {requestableCourses.length && requestableCourses.every(({ id }) => selectedIds.includes(id)) ? 'Clear selection' : 'Select all available'}
                </button>
              </div>

              {!options.courses.length ? <EmptyState title="No course units available" message="No course units are available for the department and course in your registration number." /> :
                !visibleCourses.length ? <EmptyState title="No matching courses" message="Try a different course code or name." /> : (
                  <div className="student-course-grid">
                    {visibleCourses.map((course) => {
                      const request = periodRequests.get(course.id)
                      const enrolled = periodEnrollments.has(course.id)
                      const pending = request?.status === 'PENDING'
                      const approved = request?.status === 'APPROVED'
                      const unavailable = !course.lecturers.length
                      const disabled = !periodId || enrolled || pending || approved || unavailable
                      return (
                        <label className={`student-course-card${selectedIds.includes(course.id) ? ' selected' : ''}${disabled ? ' disabled' : ''}`} key={course.id}>
                          <input type="checkbox" checked={selectedIds.includes(course.id)} disabled={disabled} onChange={() => toggleCourse(course.id)} />
                          <span className="student-course-check" aria-hidden="true">{selectedIds.includes(course.id) && <Check size={15} />}</span>
                          <span className="student-course-info">
                            <strong>{course.code}</strong>
                            <span>{course.name}</span>
                            <small>{course.lecturers.length ? `Lecturer${course.lecturers.length === 1 ? '' : 's'}: ${course.lecturers.map(({ displayName }) => displayName || 'Assigned lecturer').join(', ')}` : 'Awaiting lecturer assignment'}</small>
                          </span>
                          {enrolled ? <span className="student-course-status enrolled"><CheckCheck size={14} /> Enrolled{!periodId ? ` · ${[...(enrolledPeriodLabels.get(course.id) || [])].join(', ')}` : ''}</span> :
                            pending ? <span className="student-course-status pending"><Clock3 size={14} /> Pending</span> :
                              approved ? <span className="student-course-status enrolled"><CheckCheck size={14} /> Approved</span> :
                              request?.status === 'REJECTED' ? <span className="student-course-status rejected"><X size={14} /> Rejected · retry</span> :
                                unavailable ? <span className="student-course-status unavailable">Unavailable</span> : null}
                        </label>
                      )
                    })}
                  </div>
                )}

              <footer className="student-enrollment-footer">
                <span>{selectedIds.length} course{selectedIds.length === 1 ? '' : 's'} selected</span>
                <button className="button button-primary" type="button" disabled={submitting || !selectedPeriod || !selectedIds.length} onClick={submitRequests}>
                  <Send size={16} /> {submitting ? 'Sending requests…' : 'Request enrollment'}
                </button>
              </footer>
            </div>
          ) : options.requests.length === 0 ? (
            <EmptyState title="No enrollment requests yet" message="Select course units from your registration-number course and send your first enrollment request." />
          ) : (
            <div className="student-enrollment-request-list">
              {options.requests.map((request) => (
                <article className="student-enrollment-request-card" key={request.id}>
                  <span className={`student-request-icon ${request.status.toLowerCase()}`}>
                    {request.status === 'APPROVED' ? <CheckCheck size={18} /> : request.status === 'REJECTED' ? <X size={18} /> : <Clock3 size={18} />}
                  </span>
                  <div className="student-request-course"><strong>{request.courseUnit.code}</strong><span>{request.courseUnit.name}</span></div>
                  <div className="student-request-period"><small>Academic period</small><span>{request.academicPeriod.name}</span></div>
                  <div className={`student-request-status ${request.status.toLowerCase()}`}>{request.status.toLowerCase()}</div>
                  <time>{new Date(request.updatedAt).toLocaleDateString()}</time>
                </article>
              ))}
            </div>
          )}
    </section>
  )
}
