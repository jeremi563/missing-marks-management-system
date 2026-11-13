import { useEffect, useState } from 'react'
import {
  createAdminAcademicPeriod,
  createAdminAssessment,
  createAdminClassroom,
  createAdminCourse,
  createAdminCourseUnit,
  getAdminCourses,
  getAdminCourseUnits,
  getAdminDepartments,
} from '../../api/admin'
import { extractRecords } from '../shared/recordUtils'

const initialForms = {
  courses: { departmentId: '', code: '', name: '' },
  units: { courseId: '', code: '', name: '' },
  periods: { code: '', name: '', startsAt: '', endsAt: '', enrollmentOpensAt: '', enrollmentClosesAt: '' },
  classrooms: { name: '', latitude: '', longitude: '', boundaryMeters: '100', isActive: true },
  assessments: { courseUnitId: '', code: 'CAT1', name: 'CAT 1', type: 'CAT', catNumber: '1', assessmentDate: '', maximumMarks: '', requiredForEligibility: false, attendanceRequired: false, submissionRequired: false },
}

export default function AcademicRecordCreateForm({ resourceKey, onCreated }) {
  const [form, setForm] = useState(initialForms[resourceKey])
  const [departments, setDepartments] = useState([])
  const [courseUnits, setCourseUnits] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadOptions = async () => {
      setLoadingOptions(true)
      setError('')
      try {
        const [departmentResponse, coursesResponse, courseUnitsResponse] = await Promise.all([
          resourceKey === 'courses' ? getAdminDepartments({ page: 1, limit: 100 }) : null,
          resourceKey === 'units' ? getAdminCourses({ page: 1, limit: 100 }) : null,
          resourceKey === 'assessments' ? getAdminCourseUnits({ page: 1, limit: 100 }) : null,
        ])
        if (!active) return
        if (departmentResponse) setDepartments(extractRecords(departmentResponse, ['departments']))
        if (coursesResponse) setCourseUnits(extractRecords(coursesResponse, ['courses']))
        if (courseUnitsResponse) setCourseUnits(extractRecords(courseUnitsResponse, ['courseUnits', 'units']))
      } catch (requestError) {
        if (active) setError(requestError.userMessage || 'Unable to load options for this form.')
      } finally {
        if (active) setLoadingOptions(false)
      }
    }
    loadOptions()
    return () => { active = false }
  }, [resourceKey])

  const update = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setCreating(true)
    setError('')
    try {
      if (resourceKey === 'courses') {
        await createAdminCourse({ ...form, code: form.code.trim(), name: form.name.trim() })
      } else if (resourceKey === 'units') {
        await createAdminCourseUnit({ ...form, code: form.code.trim(), name: form.name.trim() })
      } else if (resourceKey === 'periods') {
        await createAdminAcademicPeriod({
          name: form.name.trim(),
          ...(form.code.trim() ? { code: form.code.trim() } : {}),
          ...(form.startsAt ? { startsAt: new Date(`${form.startsAt}T00:00:00.000Z`).toISOString() } : {}),
          ...(form.endsAt ? { endsAt: new Date(`${form.endsAt}T00:00:00.000Z`).toISOString() } : {}),
          ...(form.enrollmentOpensAt ? { enrollmentOpensAt: new Date(`${form.enrollmentOpensAt}T00:00:00.000Z`).toISOString() } : {}),
          ...(form.enrollmentClosesAt ? { enrollmentClosesAt: new Date(`${form.enrollmentClosesAt}T23:59:59.999Z`).toISOString() } : {}),
        })
      } else if (resourceKey === 'classrooms') {
        await createAdminClassroom({
          name: form.name.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          boundaryMeters: Number(form.boundaryMeters),
          isActive: form.isActive,
        })
      } else if (resourceKey === 'assessments') {
        const isCat = form.type.trim().toUpperCase() === 'CAT'
        const { courseUnitId, assessmentDate, maximumMarks, requiredForEligibility, attendanceRequired, submissionRequired } = form
        await createAdminAssessment({
          courseUnitId,
          name: isCat ? `CAT ${form.catNumber}` : form.name.trim(),
          type: isCat ? 'CAT' : form.type.trim(),
          ...(isCat ? { code: `CAT${form.catNumber}` } : form.code.trim() ? { code: form.code.trim() } : {}),
          ...(assessmentDate ? { assessmentDate: new Date(`${assessmentDate}T00:00:00.000Z`).toISOString() } : {}),
          ...(maximumMarks !== '' ? { maximumMarks: Number(maximumMarks) } : {}),
          requiredForEligibility,
          attendanceRequired,
          submissionRequired,
        })
      }
      setForm(initialForms[resourceKey])
      onCreated()
    } catch (requestError) {
      setError(requestError.userMessage || `Unable to create ${resourcesLabel[resourceKey].toLowerCase()}.`)
    } finally {
      setCreating(false)
    }
  }

  const label = resourcesLabel[resourceKey]
  const optionsUnavailable = ['courses', 'units', 'assessments'].includes(resourceKey)
    && (loadingOptions || (resourceKey === 'courses' && departments.length === 0)
      || (resourceKey === 'units' && courseUnits.length === 0)
      || (resourceKey === 'assessments' && courseUnits.length === 0))

  return (
    <form className="panel academic-record-form" onSubmit={submit}>
      <h3>Create {label.toLowerCase().replace(/s$/, '')}</h3>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {resourceKey === 'courses' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="course-department">Department</label><select id="course-department" name="departmentId" value={form.departmentId} onChange={update} required><option value="">Select a department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="course-code">Two-digit course identifier</label><input id="course-code" name="code" value={form.code} onChange={update} inputMode="numeric" pattern="[0-9]{2}" maxLength={2} placeholder="16" required /></div>
          <div className="form-field"><label htmlFor="course-name">Course name</label><input id="course-name" name="name" value={form.name} onChange={update} maxLength={200} required /></div>
        </div>
      )}
      {resourceKey === 'units' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="unit-course">Course</label><select id="unit-course" name="courseId" value={form.courseId} onChange={update} required><option value="">Select a course</option>{courseUnits.map((course) => <option key={course.id} value={course.id}>{course.department?.code || course.department?.name} · {course.code} — {course.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="unit-code">Course-unit code</label><input id="unit-code" name="code" value={form.code} onChange={update} maxLength={50} required /></div>
          <div className="form-field"><label htmlFor="unit-name">Course-unit name</label><input id="unit-name" name="name" value={form.name} onChange={update} maxLength={200} required /></div>
        </div>
      )}
      {resourceKey === 'periods' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="period-name">Academic period name</label><input id="period-name" name="name" value={form.name} onChange={update} maxLength={200} required /></div>
          <div className="form-field"><label htmlFor="period-code">Period code (optional)</label><input id="period-code" name="code" value={form.code} onChange={update} maxLength={80} /></div>
          <div className="form-field"><label htmlFor="period-start">Start date (optional)</label><input id="period-start" type="date" name="startsAt" value={form.startsAt} onChange={update} /></div>
          <div className="form-field"><label htmlFor="period-end">End date (optional)</label><input id="period-end" type="date" name="endsAt" value={form.endsAt} onChange={update} /></div>
          <div className="form-field"><label htmlFor="period-enrollment-opens">Course enrollment opens (optional)</label><input id="period-enrollment-opens" type="date" name="enrollmentOpensAt" value={form.enrollmentOpensAt} onChange={update} /><small>Students can request enrollment from this date.</small></div>
          <div className="form-field"><label htmlFor="period-enrollment-closes">Course enrollment closes (optional)</label><input id="period-enrollment-closes" type="date" name="enrollmentClosesAt" value={form.enrollmentClosesAt} onChange={update} /><small>The closing date remains open through the end of that day. Leave both window dates blank to keep enrollment closed.</small></div>
        </div>
      )}
      {resourceKey === 'classrooms' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="classroom-name">Classroom name</label><input id="classroom-name" name="name" value={form.name} onChange={update} maxLength={200} placeholder="e.g. Block A, Room 12" required /></div>
          <div className="form-field"><label htmlFor="classroom-latitude">GPS latitude</label><input id="classroom-latitude" name="latitude" type="number" value={form.latitude} onChange={update} min="-90" max="90" step="any" placeholder="e.g. 0.3476" required /><small>Latitude from −90 to 90 degrees.</small></div>
          <div className="form-field"><label htmlFor="classroom-longitude">GPS longitude</label><input id="classroom-longitude" name="longitude" type="number" value={form.longitude} onChange={update} min="-180" max="180" step="any" placeholder="e.g. 32.5825" required /><small>Longitude from −180 to 180 degrees.</small></div>
          <div className="form-field"><label htmlFor="classroom-boundary">GPS boundary (metres)</label><input id="classroom-boundary" name="boundaryMeters" type="number" value={form.boundaryMeters} onChange={update} min="1" max="10000" step="1" required /><small>Maximum distance from the classroom location for attendance verification.</small></div>
          <label className="academic-record-checkbox"><input type="checkbox" name="isActive" checked={form.isActive} onChange={update} /> Available to lecturers</label>
        </div>
      )}
      {resourceKey === 'assessments' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="assessment-course">Course unit</label><select id="assessment-course" name="courseUnitId" value={form.courseUnitId} onChange={update} required><option value="">Select a course unit</option>{courseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="assessment-type">Type</label><input id="assessment-type" name="type" value={form.type} onChange={(event) => {
            const type = event.target.value
              setForm((current) => ({
                ...current,
                type,
                ...(type.trim().toUpperCase() === 'CAT'
                  ? { code: `CAT${current.catNumber}`, name: `CAT ${current.catNumber}` }
                  : current.type.trim().toUpperCase() === 'CAT' ? { code: '', name: '' } : {}),
              }))
          }} maxLength={80} placeholder="CAT, EXAM, or another type" required /><small>Use CAT to configure the CAT 1 or CAT 2 session option.</small></div>
          {form.type.trim().toUpperCase() === 'CAT' ? (
            <div className="form-field"><label htmlFor="assessment-cat-number">CAT number</label><select id="assessment-cat-number" name="catNumber" value={form.catNumber} onChange={(event) => setForm((current) => ({ ...current, catNumber: event.target.value, code: `CAT${event.target.value}`, name: `CAT ${event.target.value}` }))} required><option value="1">CAT 1</option><option value="2">CAT 2</option></select><small>The code and name are set consistently so lecturers can select the configured CAT when creating attendance.</small></div>
          ) : (
            <>
              <div className="form-field"><label htmlFor="assessment-name">Assessment name</label><input id="assessment-name" name="name" value={form.name} onChange={update} maxLength={200} required /></div>
              <div className="form-field"><label htmlFor="assessment-code">Assessment code (optional)</label><input id="assessment-code" name="code" value={form.code} onChange={update} maxLength={80} /></div>
            </>
          )}
          <div className="form-field"><label htmlFor="assessment-date">Date (optional)</label><input id="assessment-date" type="date" name="assessmentDate" value={form.assessmentDate} onChange={update} /></div>
          <div className="form-field"><label htmlFor="assessment-marks">Maximum marks (optional)</label><input id="assessment-marks" type="number" name="maximumMarks" value={form.maximumMarks} onChange={update} min="0" max="999999.99" step="0.01" /></div>
          <label className="academic-record-checkbox"><input type="checkbox" name="requiredForEligibility" checked={form.requiredForEligibility} onChange={update} /> Required for eligibility</label>
          <label className="academic-record-checkbox"><input type="checkbox" name="attendanceRequired" checked={form.attendanceRequired} onChange={update} /> Attendance required</label>
          <label className="academic-record-checkbox"><input type="checkbox" name="submissionRequired" checked={form.submissionRequired} onChange={update} /> Submission required</label>
        </div>
      )}
      {optionsUnavailable && <p className="field-hint">{loadingOptions ? 'Loading form options…' : `Set up the required ${resourceKey === 'courses' ? 'departments' : resourceKey === 'units' ? 'courses' : 'course units'} first.`}</p>}
      <button className="button button-primary" type="submit" disabled={creating || optionsUnavailable}>{creating ? 'Creating…' : `Create ${label.toLowerCase().replace(/s$/, '')}`}</button>
    </form>
  )
}

const resourcesLabel = {
  courses: 'Courses',
  units: 'Course units',
  periods: 'Academic periods',
  classrooms: 'Classrooms',
  assessments: 'Assessments',
}
