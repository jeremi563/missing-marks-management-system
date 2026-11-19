import { useEffect, useState } from 'react'
import { getAdminAcademicPeriods, getAdminCourses, saveAdminAcademicYearSchedule } from '../../api/admin'
import { academicYearForDate, nairobiDateAtEndOfDay, nairobiDateAtStartOfDay } from '../../shared/academic-year'
import { fetchAllRecordPages } from '../shared/recordUtils'

const dateInputValue = (value) => {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${fields.year}-${fields.month}-${fields.day}`
}

function defaultSemester(start, end) {
  return {
    startsAt: start,
    endsAt: end,
    enrollmentOpensAt: '',
    enrollmentClosesAt: '',
  }
}

function defaultSchedule(year) {
  const startYear = Number(year.slice(0, 4))
  return {
    semester1: defaultSemester(`${startYear}-09-01`, `${startYear}-12-20`),
    semester2: defaultSemester(`${startYear + 1}-01-05`, `${startYear + 1}-04-30`),
    semester3: defaultSemester(`${startYear + 1}-05-01`, `${startYear + 1}-08-31`),
    courseIds: [],
  }
}

function scheduleForYear(year, periods) {
  const schedule = defaultSchedule(year)
  const matching = periods.filter((period) =>
    (period.academicYear || academicYearForDate(period.startsAt)) === year
  )
  for (const semester of [1, 2, 3]) {
    const period = matching.find((item) => item.semester === semester)
    if (!period) continue
    schedule[`semester${semester}`] = {
      startsAt: dateInputValue(period.startsAt),
      endsAt: dateInputValue(period.endsAt),
      enrollmentOpensAt: dateInputValue(period.enrollmentOpensAt),
      enrollmentClosesAt: dateInputValue(period.enrollmentClosesAt),
    }
    if (semester === 3) schedule.courseIds = period.eligibleCourses?.map(({ id }) => id) ?? []
  }
  return schedule
}

function toDateTime(value, endOfDay = false) {
  if (!value) return null
  const date = endOfDay ? nairobiDateAtEndOfDay(value) : nairobiDateAtStartOfDay(value)
  if (!date) throw new Error('Enter valid semester and enrollment dates.')
  return date.toISOString()
}

export default function AcademicYearScheduleForm({ onSaved }) {
  const currentYear = academicYearForDate(new Date())
  const [periods, setPeriods] = useState([])
  const [courses, setCourses] = useState([])
  const [schedule, setSchedule] = useState(() => defaultSchedule(currentYear))
  const [includeSemester3, setIncludeSemester3] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      getAdminAcademicPeriods({ page: 1, limit: 100 }),
      getAdminCourses({ page: 1, limit: 100 }),
    ]).then(async ([periodResponse, courseResponse]) => {
      if (!active) return
      const [loadedPeriods, loadedCourses] = await Promise.all([
        fetchAllRecordPages((page) => getAdminAcademicPeriods({ page, limit: 100 }), periodResponse, ['academicPeriods', 'periods']),
        fetchAllRecordPages((page) => getAdminCourses({ page, limit: 100 }), courseResponse, ['courses']),
      ])
      if (!active) return
      setPeriods(loadedPeriods)
      setCourses(loadedCourses)
      setSchedule(scheduleForYear(currentYear, loadedPeriods))
      setIncludeSemester3(loadedPeriods.some((period) =>
        (period.academicYear || academicYearForDate(period.startsAt)) === currentYear
        && period.semester === 3
      ))
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load academic-year schedule options.')
    }).finally(() => {
      if (active) {
        setCurrentTime(Date.now())
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [currentYear])

  const updateSemester = (semester, field, value) => {
    setSchedule((current) => ({
      ...current,
      [`semester${semester}`]: { ...current[`semester${semester}`], [field]: value },
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const serializeSemester = (semester) => ({
        startsAt: toDateTime(semester.startsAt),
        endsAt: toDateTime(semester.endsAt, true),
        enrollmentOpensAt: toDateTime(semester.enrollmentOpensAt),
        enrollmentClosesAt: toDateTime(semester.enrollmentClosesAt, true),
      })
      if (activeSemester === 3 && !includeSemester3) return
      if (activeSemester === 3 && !schedule.courseIds.length) {
        throw new Error('Select at least one course for semester 3.')
      }
      await saveAdminAcademicYearSchedule(currentYear, {
        semester: activeSemester,
        schedule: serializeSemester(schedule[`semester${activeSemester}`]),
        ...(activeSemester === 3 ? { courseIds: schedule.courseIds } : {}),
      })
      onSaved()
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'Unable to save the academic-year schedule.')
    } finally {
      setSaving(false)
    }
  }

  const yearPeriods = periods.filter((period) =>
    (period.academicYear || academicYearForDate(period.startsAt)) === currentYear
  )
  const semesterPeriods = [1, 2, 3].map((semester) =>
    yearPeriods.find((period) => period.semester === semester)
  )
  let activeSemester = null
  if (!semesterPeriods[0] || currentTime <= new Date(semesterPeriods[0].endsAt).valueOf()) {
    activeSemester = 1
  } else if (!semesterPeriods[1] || currentTime <= new Date(semesterPeriods[1].endsAt).valueOf()) {
    activeSemester = 2
  } else if (!semesterPeriods[2] || currentTime <= new Date(semesterPeriods[2].endsAt).valueOf()) {
    activeSemester = 3
  }

  const renderSemester = (semester, label) => (
    <fieldset className="academic-semester-schedule">
      <legend>{label}</legend>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={`semester-${semester}-start`}>Starts</label>
          <input id={`semester-${semester}-start`} type="date" value={schedule[`semester${semester}`].startsAt} onChange={(event) => updateSemester(semester, 'startsAt', event.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor={`semester-${semester}-end`}>Ends</label>
          <input id={`semester-${semester}-end`} type="date" value={schedule[`semester${semester}`].endsAt} onChange={(event) => updateSemester(semester, 'endsAt', event.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor={`semester-${semester}-enrollment-open`}>Enrollment opens (optional)</label>
          <input id={`semester-${semester}-enrollment-open`} type="date" value={schedule[`semester${semester}`].enrollmentOpensAt} onChange={(event) => updateSemester(semester, 'enrollmentOpensAt', event.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor={`semester-${semester}-enrollment-close`}>Enrollment closes (optional)</label>
          <input id={`semester-${semester}-enrollment-close`} type="date" value={schedule[`semester${semester}`].enrollmentClosesAt} onChange={(event) => updateSemester(semester, 'enrollmentClosesAt', event.target.value)} />
        </div>
      </div>
    </fieldset>
  )

  return (
    <form className="panel academic-record-form academic-year-schedule-form" onSubmit={submit}>
      <h3>Academic-year semester schedule</h3>
      <p>Current academic year: <strong>{currentYear}</strong>. Semesters are set up in order; the next semester becomes available after the previous semester’s configured end date.</p>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {loading ? <p role="status">Loading current schedule and courses…</p> : (
        <>
          {activeSemester ? (
            <>
              <p className="field-hint">
                {semesterPeriods[activeSemester - 1]
                  ? `Semester ${activeSemester} is configured and can be adjusted until its end date.`
                  : `Next setup step: Semester ${activeSemester}.`}
              </p>
              {activeSemester === 3 ? (
                <>
                  <label className="academic-record-checkbox">
                    <input type="checkbox" checked={includeSemester3} onChange={(event) => setIncludeSemester3(event.target.checked)} />
                    Configure semester 3 for selected courses
                  </label>
                  {!includeSemester3 && <p className="field-hint">Leave this off if none of the courses requires a third semester.</p>}
                  {includeSemester3 && (
                    <>
                      {renderSemester(3, 'Semester 3 · optional course-specific schedule')}
                      <p className="field-hint">Suggested dates are May 1–August 31. The end date may be adjusted beyond April 30 but must remain in this academic year. One shared schedule applies to all selected courses.</p>
                      <fieldset className="academic-semester-course-list">
                        <legend>Courses taking semester 3</legend>
                        {courses.length
                          ? courses.map((course) => (
                            <label className="academic-record-checkbox" key={course.id}>
                              <input
                                type="checkbox"
                                checked={schedule.courseIds.includes(course.id)}
                                onChange={(event) => setSchedule((current) => ({
                                  ...current,
                                  courseIds: event.target.checked
                                    ? [...new Set([...current.courseIds, course.id])]
                                    : current.courseIds.filter((id) => id !== course.id),
                                }))}
                              />
                              {course.department?.code || course.department?.name} · {course.code} — {course.name}
                            </label>
                          ))
                          : <p>No courses are configured yet.</p>}
                      </fieldset>
                    </>
                  )}
                </>
              ) : renderSemester(activeSemester, `Semester ${activeSemester}${activeSemester === 1 ? ' · September to December' : ' · January to April'}`)}
              {(activeSemester !== 3 || includeSemester3) && (
                <button className="button button-primary" type="submit" disabled={saving || (activeSemester === 3 && courses.length === 0)}>
                  {saving ? 'Saving semester…' : `Save semester ${activeSemester}`}
                </button>
              )}
            </>
          ) : (
            <p className="field-hint" role="status">All configured semesters for {currentYear} have ended.</p>
          )}
        </>
      )}
    </form>
  )
}
