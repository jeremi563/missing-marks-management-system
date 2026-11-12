import { useCallback, useEffect, useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import { extractRecords } from '../shared/recordUtils'
import {
  getAdminAcademicPeriods,
  getAdminCourseUnits,
  getAdminDepartments,
  getAdminEnrollments,
  getAdminAssessments,
} from '../../api/admin'
import DepartmentManagement from './DepartmentManagement'
import AcademicRecordCreateForm from './AcademicRecordCreateForm'

const resources = {
  departments: { label: 'Departments', load: getAdminDepartments, keys: ['departments'] },
  courses: { label: 'Course units', load: getAdminCourseUnits, keys: ['courseUnits', 'units'] },
  periods: { label: 'Academic periods', load: getAdminAcademicPeriods, keys: ['academicPeriods', 'periods'] },
  assessments: { label: 'Assessments', load: getAdminAssessments, keys: ['assessments'] },
  enrolments: { label: 'Enrolments', load: getAdminEnrollments, keys: ['enrolments', 'enrollments'] },
}

const courseUnitColumns = [
  { label: 'Department', render: (unit) => unit.department?.name || '—' },
  { label: 'Department code', render: (unit) => unit.department?.code || '—' },
  { label: 'Course-unit code', render: (unit) => unit.code },
  { label: 'Course unit', render: (unit) => unit.name },
]

export default function AdminAcademic() {
  const [resourceKey, setResourceKey] = useState('departments')
  const [refresh, setRefresh] = useState(0)
  const [departments, setDepartments] = useState([])
  const [departmentsError, setDepartmentsError] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const resource = resources[resourceKey]
  const fetchRecords = useCallback((params) => resource.load({
    ...params,
    ...(resourceKey === 'courses' && departmentId ? { departmentId } : {}),
  }), [resource, resourceKey, departmentId])

  useEffect(() => {
    if (resourceKey !== 'courses') return undefined

    let active = true
    getAdminDepartments({ page: 1, limit: 100 })
      .then((response) => {
        if (active) {
          setDepartments(extractRecords(response, ['departments']))
          setDepartmentsError('')
        }
      })
      .catch((requestError) => {
        if (active) setDepartmentsError(requestError.userMessage || 'Unable to load departments for filtering course units.')
      })
    return () => { active = false }
  }, [resourceKey])

  return (
    <section>
      <header className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2>Academic setup</h2><p>Create and manage departments, course units, academic periods, assessments, and enrolments.</p></div></header>
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
              <AcademicRecordCreateForm
                key={resourceKey}
                resourceKey={resourceKey}
                onCreated={() => setRefresh((value) => value + 1)}
              />
              {resourceKey === 'courses' && (
                <div className="academic-department-filter">
                  {departmentsError && <p className="form-alert" role="alert">{departmentsError}</p>}
                  <div className="lecturer-directory-tabs" role="tablist" aria-label="Filter course units by department">
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
                description={`Browse configured ${resource.label.toLowerCase()}.`}
                fetchRecords={fetchRecords}
                collectionKeys={resource.keys}
                tableColumns={resourceKey === 'courses' ? courseUnitColumns : undefined}
                emptyMessage={`No ${resource.label.toLowerCase()} are configured.`}
              />
            </>
          )}
      </div>
    </section>
  )
}
