import { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import RecordListPage from '../shared/RecordListPage'
import { extractRecords } from '../shared/recordUtils'
import {
  getAdminAcademicPeriods,
  getAdminClassrooms,
  getAdminCourses,
  getAdminCourseUnits,
  getAdminDepartments,
  getAdminEnrollments,
  getAdminAssessments,
  updateAdminAcademicPeriod,
  updateAdminCourseUnit,
} from '../../api/admin'
import DepartmentManagement from './DepartmentManagement'
import AcademicRecordCreateForm from './AcademicRecordCreateForm'
import { academicYearForPeriod } from '../../shared/academic-year'

const resources = {
  departments: { label: 'Departments', load: getAdminDepartments, keys: ['departments'] },
  courses: { label: 'Courses', load: getAdminCourses, keys: ['courses'] },
  units: { label: 'Course units', load: getAdminCourseUnits, keys: ['courseUnits', 'units'] },
  periods: { label: 'Academic periods', load: getAdminAcademicPeriods, keys: ['academicPeriods', 'periods'] },
  classrooms: { label: 'Classrooms', load: getAdminClassrooms, keys: ['classrooms'] },
  assessments: { label: 'Assessments', load: getAdminAssessments, keys: ['assessments'] },
  enrolments: { label: 'Enrolments', load: getAdminEnrollments, keys: ['enrolments', 'enrollments'] },
}

const courseUnitColumns = [
  { label: 'Department', render: (unit) => unit.department?.name || '—' },
  { label: 'Course', render: (unit) => unit.course ? `${unit.course.code} — ${unit.course.name}` : 'Course not assigned' },
  { label: 'Course-unit code', render: (unit) => unit.code },
  { label: 'Course unit', render: (unit) => unit.name },
]

const courseColumns = [
  { label: 'Department', render: (course) => course.department?.name || '—' },
  { label: 'Course identifier', render: (course) => course.code },
  { label: 'Course', render: (course) => course.name },
  { label: 'Course units', render: (course) => course._count?.courseUnits ?? 0 },
]

const periodColumns = [
  { label: 'Academic period', render: (period) => period.name },
  { label: 'Academic year', render: (period) => academicYearForPeriod(period) || 'Not specified' },
  { label: 'Code', render: (period) => period.code || '—' },
  { label: 'Enrollment opens', render: (period) => period.enrollmentOpensAt ? new Date(period.enrollmentOpensAt).toLocaleString() : 'Not configured' },
  { label: 'Enrollment closes', render: (period) => period.enrollmentClosesAt ? new Date(period.enrollmentClosesAt).toLocaleString() : 'Not configured' },
]

const classroomColumns = [
  { label: 'Classroom', render: (classroom) => classroom.name },
  { label: 'Latitude', render: (classroom) => classroom.latitude },
  { label: 'Longitude', render: (classroom) => classroom.longitude },
  { label: 'GPS boundary', render: (classroom) => `${classroom.boundaryMeters} m` },
  { label: 'Status', render: (classroom) => classroom.isActive ? 'Active' : 'Inactive' },
]

const dateInputValue = (value) => value ? new Date(value).toISOString().slice(0, 10) : ''

export default function AdminAcademic() {
  const [resourceKey, setResourceKey] = useState('departments')
  const [refresh, setRefresh] = useState(0)
  const [departments, setDepartments] = useState([])
  const [courses, setCourses] = useState([])
  const [departmentsError, setDepartmentsError] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [editingCourseUnit, setEditingCourseUnit] = useState(null)
  const [editingAcademicPeriod, setEditingAcademicPeriod] = useState(null)
  const [editError, setEditError] = useState('')
  const [savingCourseUnit, setSavingCourseUnit] = useState(false)
  const [savingAcademicPeriod, setSavingAcademicPeriod] = useState(false)
  const [notice, setNotice] = useState('')
  const resource = resources[resourceKey]
  const fetchRecords = useCallback((params) => resource.load({
    ...params,
    ...((resourceKey === 'courses' || resourceKey === 'units') && departmentId ? { departmentId } : {}),
  }), [resource, resourceKey, departmentId])

  useEffect(() => {
    if (resourceKey !== 'courses' && resourceKey !== 'units') return undefined

    let active = true
    Promise.all([
      getAdminDepartments({ page: 1, limit: 100 }),
      getAdminCourses({ page: 1, limit: 100 }),
    ])
      .then(([departmentResponse, courseResponse]) => {
        if (active) {
          setDepartments(extractRecords(departmentResponse, ['departments']))
          setCourses(extractRecords(courseResponse, ['courses']))
          setDepartmentsError('')
        }
      })
      .catch((requestError) => {
        if (active) setDepartmentsError(requestError.userMessage || 'Unable to load departments for filtering course units.')
      })
    return () => { active = false }
  }, [resourceKey])

  const startCourseUnitEdit = (courseUnit) => {
    setEditingCourseUnit({
      id: courseUnit.id,
      code: courseUnit.code,
      name: courseUnit.name,
      courseId: courseUnit.course?.id || '',
    })
    setEditError('')
  }

  const saveCourseUnit = async (event) => {
    event.preventDefault()
    setSavingCourseUnit(true)
    setEditError('')
    setNotice('')
    try {
      await updateAdminCourseUnit(editingCourseUnit.id, {
        code: editingCourseUnit.code.trim(),
        name: editingCourseUnit.name.trim(),
        courseId: editingCourseUnit.courseId,
      })
      setEditingCourseUnit(null)
      setNotice('Course unit updated.')
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setEditError(requestError.userMessage || 'Unable to update this course unit.')
    } finally {
      setSavingCourseUnit(false)
    }
  }

  const startAcademicPeriodEdit = (period) => {
    setEditingAcademicPeriod({
      id: period.id,
      name: period.name,
      code: period.code || '',
      enrollmentOpensAt: dateInputValue(period.enrollmentOpensAt),
      enrollmentClosesAt: dateInputValue(period.enrollmentClosesAt),
    })
    setEditError('')
  }

  const saveAcademicPeriod = async (event) => {
    event.preventDefault()
    setSavingAcademicPeriod(true)
    setEditError('')
    setNotice('')
    try {
      await updateAdminAcademicPeriod(editingAcademicPeriod.id, {
        name: editingAcademicPeriod.name.trim(),
        code: editingAcademicPeriod.code.trim() || null,
        enrollmentOpensAt: editingAcademicPeriod.enrollmentOpensAt
          ? new Date(`${editingAcademicPeriod.enrollmentOpensAt}T00:00:00.000Z`).toISOString()
          : null,
        enrollmentClosesAt: editingAcademicPeriod.enrollmentClosesAt
          ? new Date(`${editingAcademicPeriod.enrollmentClosesAt}T23:59:59.999Z`).toISOString()
          : null,
      })
      setEditingAcademicPeriod(null)
      setNotice('Academic period and enrollment window updated.')
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setEditError(requestError.userMessage || 'Unable to update this academic period.')
    } finally {
      setSavingAcademicPeriod(false)
    }
  }

  return (
    <section>
      <header className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2>Academic setup</h2><p>Create and manage departments, courses, course units, academic periods, assessments, and enrolments.</p></div></header>
      <div className="lecturer-directory-tabs" role="tablist" aria-label="Academic record types">
        {Object.entries(resources).map(([key, item]) => (
          <button
            key={key}
            id={`academic-tab-${key}`}
            className={`lecturer-directory-tab ${resourceKey === key ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={resourceKey === key}
            aria-controls="academic-record-panel"
            onClick={() => setResourceKey(key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="academic-record-panel" role="tabpanel" aria-labelledby={`academic-tab-${resourceKey}`}>
        {resourceKey === 'departments'
          ? <DepartmentManagement />
          : (
            <>
              {notice && <div className="form-success" role="status">{notice}</div>}
              {resourceKey === 'enrolments' ? (
                <p className="field-hint">Enrolments are created when lecturers approve students’ course-unit requests. Administrators can review these records here.</p>
              ) : <AcademicRecordCreateForm
                key={resourceKey}
                resourceKey={resourceKey}
                onCreated={() => setRefresh((value) => value + 1)}
              />}
              {(resourceKey === 'courses' || resourceKey === 'units') && (
                <div className="academic-department-filter">
                  {departmentsError && <p className="form-alert" role="alert">{departmentsError}</p>}
                  <div className="lecturer-directory-tabs" role="tablist" aria-label={`Filter ${resource.label.toLowerCase()} by department`}>
                    <button
                      id="course-unit-department-tab-all"
                      className={`lecturer-directory-tab ${departmentId === '' ? 'active' : ''}`}
                      type="button"
                      role="tab"
                      aria-selected={departmentId === ''}
                      aria-controls="course-unit-records"
                      disabled={Boolean(departmentsError)}
                      onClick={() => setDepartmentId('')}
                    >
                      All departments
                    </button>
                    {departments.map((department) => (
                      <button
                        key={department.id}
                        id={`course-unit-department-tab-${department.id}`}
                        className={`lecturer-directory-tab ${departmentId === department.id ? 'active' : ''}`}
                        type="button"
                        role="tab"
                        aria-selected={departmentId === department.id}
                        aria-controls="course-unit-records"
                        disabled={Boolean(departmentsError)}
                        onClick={() => setDepartmentId(department.id)}
                      >
                        {department.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <RecordListPage
                key={`${resourceKey}:${departmentId}:${refresh}`}
                contentId={resourceKey === 'courses' ? 'course-unit-records' : undefined}
                title={resource.label}
                description={resourceKey === 'enrolments'
                  ? 'Review course-unit enrolments approved by lecturers.'
                  : `Browse configured ${resource.label.toLowerCase()}.`}
                fetchRecords={fetchRecords}
                collectionKeys={resource.keys}
                tableColumns={resourceKey === 'units' ? courseUnitColumns : resourceKey === 'courses' ? courseColumns : resourceKey === 'periods' ? periodColumns : resourceKey === 'classrooms' ? classroomColumns : undefined}
                renderActions={resourceKey === 'units'
                  ? (courseUnit) => (
                    <button className="button button-secondary" type="button" onClick={() => startCourseUnitEdit(courseUnit)}>
                      <Pencil size={15} /> Edit
                    </button>
                  )
                  : resourceKey === 'periods'
                    ? (period) => (
                      <button className="button button-secondary" type="button" onClick={() => startAcademicPeriodEdit(period)}>
                        <Pencil size={15} /> Edit window
                      </button>
                    )
                  : undefined}
                emptyMessage={`No ${resource.label.toLowerCase()} are configured.`}
              />
            </>
          )}
      </div>
      {editingCourseUnit && (
        <dialog open className="panel admin-edit-dialog" aria-labelledby="edit-course-unit-title">
            <header className="page-heading">
              <div>
                <p className="eyebrow">COURSE UNIT</p>
                <h2 id="edit-course-unit-title">Edit course unit</h2>
                <p>Assign the unit to its course and update its code or name. Units with academic history cannot move between departments.</p>
              </div>
            </header>
            {editError && <div className="form-alert" role="alert">{editError}</div>}
            <form className="form-stack" onSubmit={saveCourseUnit}>
              <div className="form-field">
                <label htmlFor="edit-course-unit-code">Course-unit code</label>
                <input
                  id="edit-course-unit-code"
                  value={editingCourseUnit.code}
                  onChange={(event) => setEditingCourseUnit((current) => ({ ...current, code: event.target.value }))}
                  maxLength={50}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="edit-course-unit-name">Course-unit name</label>
                <input
                  id="edit-course-unit-name"
                  value={editingCourseUnit.name}
                  onChange={(event) => setEditingCourseUnit((current) => ({ ...current, name: event.target.value }))}
                  maxLength={200}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="edit-course-unit-course">Course</label>
                <select
                  id="edit-course-unit-course"
                  value={editingCourseUnit.courseId}
                  onChange={(event) => setEditingCourseUnit((current) => ({ ...current, courseId: event.target.value }))}
                  required
                  disabled={Boolean(departmentsError)}
                >
                  <option value="">Select a course</option>
                  {courses.filter((course) => !departmentId || course.departmentId === departmentId).map((course) => (
                    <option value={course.id} key={course.id}>{course.department?.code || course.department?.name} · {course.code} — {course.name}</option>
                  ))}
                </select>
                {departmentsError && <p className="form-alert" role="alert">{departmentsError}</p>}
              </div>
              <div className="record-actions">
                <button className="button button-secondary" type="button" onClick={() => setEditingCourseUnit(null)} disabled={savingCourseUnit}>
                  Cancel
                </button>
                <button className="button button-primary" type="submit" disabled={savingCourseUnit || Boolean(departmentsError)}>
                  {savingCourseUnit ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
        </dialog>
      )}
      {editingAcademicPeriod && (
        <dialog open className="panel admin-edit-dialog" aria-labelledby="edit-academic-period-title">
          <header className="page-heading">
            <div>
              <p className="eyebrow">ACADEMIC PERIOD</p>
              <h2 id="edit-academic-period-title">Edit enrollment window</h2>
              <p>Students can request enrollment only between these dates. Clear both dates to close enrollment.</p>
            </div>
          </header>
          {editError && <div className="form-alert" role="alert">{editError}</div>}
          <form className="form-stack" onSubmit={saveAcademicPeriod}>
            <div className="form-field">
              <label htmlFor="edit-academic-period-name">Period name</label>
              <input id="edit-academic-period-name" value={editingAcademicPeriod.name} onChange={(event) => setEditingAcademicPeriod((current) => ({ ...current, name: event.target.value }))} maxLength={200} required />
            </div>
            <div className="form-field">
              <label htmlFor="edit-academic-period-code">Period code</label>
              <input id="edit-academic-period-code" value={editingAcademicPeriod.code} onChange={(event) => setEditingAcademicPeriod((current) => ({ ...current, code: event.target.value }))} maxLength={80} />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="edit-enrollment-opens">Enrollment opens</label>
                <input id="edit-enrollment-opens" type="date" value={editingAcademicPeriod.enrollmentOpensAt} onChange={(event) => setEditingAcademicPeriod((current) => ({ ...current, enrollmentOpensAt: event.target.value }))} />
              </div>
              <div className="form-field">
                <label htmlFor="edit-enrollment-closes">Enrollment closes</label>
                <input id="edit-enrollment-closes" type="date" value={editingAcademicPeriod.enrollmentClosesAt} onChange={(event) => setEditingAcademicPeriod((current) => ({ ...current, enrollmentClosesAt: event.target.value }))} />
              </div>
            </div>
            <div className="record-actions">
              <button className="button button-secondary" type="button" onClick={() => setEditingAcademicPeriod(null)} disabled={savingAcademicPeriod}>Cancel</button>
              <button className="button button-primary" type="submit" disabled={savingAcademicPeriod}>{savingAcademicPeriod ? 'Saving…' : 'Save window'}</button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  )
}
