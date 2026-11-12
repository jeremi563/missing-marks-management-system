import { useEffect, useState } from 'react'
import {
  createAdminAcademicPeriod,
  createAdminAssessment,
  createAdminCourseUnit,
  createAdminEnrollment,
  getAdminAcademicPeriods,
  getAdminCourseUnits,
  getAdminDepartments,
  getAdminUsers,
} from '../../api/admin'
import { extractRecords } from '../shared/recordUtils'

const initialForms = {
  courses: { departmentId: '', code: '', name: '' },
  periods: { code: '', name: '', startsAt: '', endsAt: '' },
  assessments: { courseUnitId: '', code: '', name: '', type: '', assessmentDate: '', maximumMarks: '', requiredForEligibility: false, attendanceRequired: false, submissionRequired: false },
  enrolments: { studentProfileId: '', courseUnitId: '', academicPeriodId: '' },
}

export default function AcademicRecordCreateForm({ resourceKey, onCreated }) {
  const [form, setForm] = useState(initialForms[resourceKey])
  const [departments, setDepartments] = useState([])
  const [courseUnits, setCourseUnits] = useState([])
  const [academicPeriods, setAcademicPeriods] = useState([])
  const [students, setStudents] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadOptions = async () => {
      setLoadingOptions(true)
      setError('')
      try {
        const [departmentResponse, courseUnitResponse, periodResponse, studentResponse] = await Promise.all([
          resourceKey === 'courses' ? getAdminDepartments({ page: 1, limit: 100 }) : null,
          ['assessments', 'enrolments'].includes(resourceKey) ? getAdminCourseUnits({ page: 1, limit: 100 }) : null,
          resourceKey === 'enrolments' ? getAdminAcademicPeriods({ page: 1, limit: 100 }) : null,
          resourceKey === 'enrolments' ? getAdminUsers({ page: 1, limit: 100, role: 'student', isActive: true }) : null,
        ])
        if (!active) return
        if (departmentResponse) setDepartments(extractRecords(departmentResponse, ['departments']))
        if (courseUnitResponse) setCourseUnits(extractRecords(courseUnitResponse, ['courseUnits', 'units']))
        if (periodResponse) setAcademicPeriods(extractRecords(periodResponse, ['academicPeriods', 'periods']))
        if (studentResponse) setStudents(extractRecords(studentResponse, ['users']).filter(({ studentProfile }) => studentProfile?.id))
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
        await createAdminCourseUnit({ ...form, code: form.code.trim(), name: form.name.trim() })
      } else if (resourceKey === 'periods') {
        await createAdminAcademicPeriod({
          name: form.name.trim(),
          ...(form.code.trim() ? { code: form.code.trim() } : {}),
          ...(form.startsAt ? { startsAt: new Date(`${form.startsAt}T00:00:00.000Z`).toISOString() } : {}),
          ...(form.endsAt ? { endsAt: new Date(`${form.endsAt}T00:00:00.000Z`).toISOString() } : {}),
        })
      } else if (resourceKey === 'assessments') {
        await createAdminAssessment({
          ...form,
          name: form.name.trim(),
          type: form.type.trim(),
          ...(form.code.trim() ? { code: form.code.trim() } : {}),
          ...(form.assessmentDate ? { assessmentDate: new Date(`${form.assessmentDate}T00:00:00.000Z`).toISOString() } : {}),
          ...(form.maximumMarks !== '' ? { maximumMarks: Number(form.maximumMarks) } : {}),
        })
      } else {
        await createAdminEnrollment(form)
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
  const optionsUnavailable = ['courses', 'assessments', 'enrolments'].includes(resourceKey)
    && (loadingOptions || (resourceKey === 'courses' && departments.length === 0)
      || (resourceKey !== 'courses' && courseUnits.length === 0)
      || (resourceKey === 'enrolments' && (academicPeriods.length === 0 || students.length === 0)))

  return (
    <form className="panel academic-record-form" onSubmit={submit}>
      <h3>Create {label.toLowerCase().replace(/s$/, '')}</h3>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {resourceKey === 'courses' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="course-department">Department</label><select id="course-department" name="departmentId" value={form.departmentId} onChange={update} required><option value="">Select a department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="course-code">Course-unit code</label><input id="course-code" name="code" value={form.code} onChange={update} maxLength={50} required /></div>
          <div className="form-field"><label htmlFor="course-name">Course-unit name</label><input id="course-name" name="name" value={form.name} onChange={update} maxLength={200} required /></div>
        </div>
      )}
      {resourceKey === 'periods' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="period-name">Academic period name</label><input id="period-name" name="name" value={form.name} onChange={update} maxLength={200} required /></div>
          <div className="form-field"><label htmlFor="period-code">Period code (optional)</label><input id="period-code" name="code" value={form.code} onChange={update} maxLength={80} /></div>
          <div className="form-field"><label htmlFor="period-start">Start date (optional)</label><input id="period-start" type="date" name="startsAt" value={form.startsAt} onChange={update} /></div>
          <div className="form-field"><label htmlFor="period-end">End date (optional)</label><input id="period-end" type="date" name="endsAt" value={form.endsAt} onChange={update} /></div>
        </div>
      )}
      {resourceKey === 'assessments' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="assessment-course">Course unit</label><select id="assessment-course" name="courseUnitId" value={form.courseUnitId} onChange={update} required><option value="">Select a course unit</option>{courseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="assessment-name">Assessment name</label><input id="assessment-name" name="name" value={form.name} onChange={update} maxLength={200} required /></div>
          <div className="form-field"><label htmlFor="assessment-code">Assessment code (optional)</label><input id="assessment-code" name="code" value={form.code} onChange={update} maxLength={80} /></div>
          <div className="form-field"><label htmlFor="assessment-type">Type</label><input id="assessment-type" name="type" value={form.type} onChange={update} maxLength={80} placeholder="e.g. CAT, Exam" required /></div>
          <div className="form-field"><label htmlFor="assessment-date">Date (optional)</label><input id="assessment-date" type="date" name="assessmentDate" value={form.assessmentDate} onChange={update} /></div>
          <div className="form-field"><label htmlFor="assessment-marks">Maximum marks (optional)</label><input id="assessment-marks" type="number" name="maximumMarks" value={form.maximumMarks} onChange={update} min="0" max="999999.99" step="0.01" /></div>
          <label className="academic-record-checkbox"><input type="checkbox" name="requiredForEligibility" checked={form.requiredForEligibility} onChange={update} /> Required for eligibility</label>
          <label className="academic-record-checkbox"><input type="checkbox" name="attendanceRequired" checked={form.attendanceRequired} onChange={update} /> Attendance required</label>
          <label className="academic-record-checkbox"><input type="checkbox" name="submissionRequired" checked={form.submissionRequired} onChange={update} /> Submission required</label>
        </div>
      )}
      {resourceKey === 'enrolments' && (
        <div className="form-grid">
          <div className="form-field"><label htmlFor="enrolment-student">Student</label><select id="enrolment-student" name="studentProfileId" value={form.studentProfileId} onChange={update} required><option value="">Select a student</option>{students.map((student) => <option key={student.studentProfile.id} value={student.studentProfile.id}>{student.displayName} — {student.studentProfile.studentNumber}</option>)}</select></div>
          <div className="form-field"><label htmlFor="enrolment-course">Course unit</label><select id="enrolment-course" name="courseUnitId" value={form.courseUnitId} onChange={update} required><option value="">Select a course unit</option>{courseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="enrolment-period">Academic period</label><select id="enrolment-period" name="academicPeriodId" value={form.academicPeriodId} onChange={update} required><option value="">Select an academic period</option>{academicPeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></div>
        </div>
      )}
      {optionsUnavailable && <p className="field-hint">{loadingOptions ? 'Loading form options…' : `Set up the required ${resourceKey === 'courses' ? 'department' : resourceKey === 'enrolments' ? 'students, course units, and academic periods' : 'course units'} first.`}</p>}
      <button className="button button-primary" type="submit" disabled={creating || optionsUnavailable}>{creating ? 'Creating…' : `Create ${label.toLowerCase().replace(/s$/, '')}`}</button>
    </form>
  )
}

const resourcesLabel = {
  courses: 'Course units',
  periods: 'Academic periods',
  assessments: 'Assessments',
  enrolments: 'Enrolments',
}
