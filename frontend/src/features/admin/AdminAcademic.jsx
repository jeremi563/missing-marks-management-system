import { useCallback, useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import {
  getAdminAcademicPeriods,
  getAdminCourseUnits,
  getAdminDepartments,
  getAdminEnrollments,
  getAdminAssessments,
} from '../../api/admin'
import DepartmentManagement from './DepartmentManagement'

const resources = {
  departments: { label: 'Departments', load: getAdminDepartments, keys: ['departments'] },
  courses: { label: 'Course units', load: getAdminCourseUnits, keys: ['courseUnits', 'units'] },
  periods: { label: 'Academic periods', load: getAdminAcademicPeriods, keys: ['academicPeriods', 'periods'] },
  assessments: { label: 'Assessments', load: getAdminAssessments, keys: ['assessments'] },
  enrolments: { label: 'Enrolments', load: getAdminEnrollments, keys: ['enrolments', 'enrollments'] },
}

export default function AdminAcademic() {
  const [resourceKey, setResourceKey] = useState('departments')
  const resource = resources[resourceKey]
  const fetchRecords = useCallback((params) => resource.load(params), [resource])
  return (
    <section>
      <header className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2>Academic setup</h2><p>Browse the core academic records managed by the system.</p></div></header>
      <div className="toolbar">
        <label htmlFor="academic-resource">Record type</label>
        <select id="academic-resource" value={resourceKey} onChange={(event) => setResourceKey(event.target.value)}>{Object.entries(resources).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
      </div>
      {resourceKey === 'departments'
        ? <DepartmentManagement />
        : <RecordListPage key={resourceKey} title={resource.label} description={`Browse configured ${resource.label.toLowerCase()}.`} fetchRecords={fetchRecords} collectionKeys={resource.keys} emptyMessage={`No ${resource.label.toLowerCase()} are configured.`} />}
    </section>
  )
}
