import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  getCodDepartmentCourseUnits,
  getCodDepartmentLecturers,
  getCodDepartmentStudents,
  getCodDepartments,
} from '../../api/cod'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import Pager from '../../components/ui/Pager'
import { extractRecords } from '../shared/recordUtils'

const PAGE_SIZE = 20
const contentTabs = [
  { key: 'course-units', label: 'Course units', load: getCodDepartmentCourseUnits },
  { key: 'students', label: 'Students', load: getCodDepartmentStudents },
  { key: 'lecturers', label: 'Lecturers', load: getCodDepartmentLecturers },
]

function unwrapResult(response) {
  return response?.data?.data ?? response?.data ?? response
}

export default function CodDepartmentWorkspace() {
  const [departments, setDepartments] = useState([])
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [activeTab, setActiveTab] = useState('course-units')
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loadedRequest, setLoadedRequest] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const selectedDepartment = departments.find(({ id }) => id === selectedDepartmentId)
  const currentTab = contentTabs.find(({ key }) => key === activeTab)
  const requestKey = `${selectedDepartmentId}:${activeTab}:${page}:${refresh}`
  const isLoading = !departmentsLoaded || Boolean(selectedDepartmentId && loadedRequest !== requestKey)

  useEffect(() => {
    let active = true
    getCodDepartments()
      .then((response) => {
        if (!active) return
        const loadedDepartments = extractRecords(response)
        setDepartments(loadedDepartments)
        setSelectedDepartmentId((current) => current || loadedDepartments[0]?.id || '')
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || 'Unable to load your designated departments.')
      })
      .finally(() => {
        if (active) setDepartmentsLoaded(true)
      })
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (!selectedDepartmentId) return undefined

    let active = true
    currentTab.load({ departmentId: selectedDepartmentId, page, limit: PAGE_SIZE })
      .then((response) => {
        if (!active) return
        const result = unwrapResult(response)
        setRecords(Array.isArray(result?.items) ? result.items : [])
        setPagination(result?.pagination ?? { page, totalPages: 1, total: 0 })
        setError('')
        setLoadedRequest(requestKey)
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.userMessage || `Unable to load department ${currentTab.label.toLowerCase()}.`)
        setLoadedRequest(requestKey)
      })
    return () => { active = false }
  }, [activeTab, currentTab, page, refresh, requestKey, selectedDepartmentId])

  const selectDepartment = (departmentId) => {
    setSelectedDepartmentId(departmentId)
    setPage(1)
  }

  const selectContentTab = (tab) => {
    setActiveTab(tab)
    setPage(1)
  }

  const retry = () => {
    setError('')
    setRefresh((value) => value + 1)
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">COD WORKSPACE</p>
          <h2>Department workspace</h2>
          <p>View course units, registered students, and lecturers for your designated departments.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={retry}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {!departmentsLoaded && !error ? <LoadingState message="Loading your departments…" /> :
        error && !departments.length ? <ErrorState title="Unable to load departments" message={error} onRetry={retry} /> :
          departments.length === 0 ? <EmptyState title="No designated departments" message="Departments assigned to you as COD will appear here." /> : (
            <>
              <div className="lecturer-directory-tabs" role="tablist" aria-label="Designated departments">
                {departments.map((department) => (
                  <button
                    key={department.id}
                    id={`cod-department-tab-${department.id}`}
                    className={`lecturer-directory-tab ${selectedDepartmentId === department.id ? 'active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={selectedDepartmentId === department.id}
                    aria-controls="cod-department-workspace-panel"
                    onClick={() => selectDepartment(department.id)}
                  >
                    {department.code || department.name}
                  </button>
                ))}
              </div>
              <section
                id="cod-department-workspace-panel"
                className="panel"
                role="tabpanel"
                aria-labelledby={`cod-department-tab-${selectedDepartmentId}`}
              >
                <header className="page-heading">
                  <div>
                    <h3>{selectedDepartment?.name}</h3>
                    <p>{pagination.total} {currentTab.label.toLowerCase()} record(s).</p>
                  </div>
                </header>
                <div className="lecturer-directory-tabs" role="tablist" aria-label={`${selectedDepartment?.name} records`}>
                  {contentTabs.map(({ key, label }) => (
                    <button
                      key={key}
                      id={`cod-content-tab-${key}`}
                      className={`lecturer-directory-tab ${activeTab === key ? 'active' : ''}`}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === key}
                      aria-controls="cod-content-panel"
                      onClick={() => selectContentTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div id="cod-content-panel" role="tabpanel" aria-labelledby={`cod-content-tab-${activeTab}`}>
                  {isLoading ? <LoadingState message={`Loading department ${currentTab.label.toLowerCase()}…`} /> :
                    error ? <ErrorState title={`Unable to load ${currentTab.label.toLowerCase()}`} message={error} onRetry={retry} /> :
                      records.length === 0 ? <EmptyState title={`No ${currentTab.label.toLowerCase()} found`} message={`No ${currentTab.label.toLowerCase()} are currently available in ${selectedDepartment?.name}.`} /> :
                        activeTab === 'course-units' ? (
                          <div className="table-wrap">
                            <table>
                              <thead><tr><th>Course-unit code</th><th>Course unit</th></tr></thead>
                              <tbody>{records.map((courseUnit) => (
                                <tr key={courseUnit.id}>
                                  <td>{courseUnit.code}</td>
                                  <td>{courseUnit.name}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        ) : activeTab === 'students' ? (
                          <div className="table-wrap">
                            <table>
                              <thead><tr><th>Student name</th><th>Registration number</th><th>Email</th><th>Status</th></tr></thead>
                              <tbody>{records.map((student) => (
                                <tr key={student.id}>
                                  <td>{student.user?.displayName || '—'}</td>
                                  <td>{student.studentNumber}</td>
                                  <td>{student.officialEmail || student.user?.email || '—'}</td>
                                  <td>{student.user?.isActive ? 'Active' : 'Inactive'}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="table-wrap">
                            <table>
                              <thead><tr><th>Lecturer name</th><th>Staff number</th><th>Email</th><th>Role</th></tr></thead>
                              <tbody>{records.map((lecturer) => {
                                const roles = lecturer.roles?.map(({ role }) => role.name) || []
                                return (
                                  <tr key={lecturer.id}>
                                    <td>{lecturer.displayName || '—'}</td>
                                    <td>{lecturer.lecturerProfile?.staffNumber || '—'}</td>
                                    <td>{lecturer.email || '—'}</td>
                                    <td>{roles.includes('cod') ? 'COD' : 'Lecturer'}</td>
                                  </tr>
                                )
                              })}</tbody>
                            </table>
                          </div>
                        )}
                  {!isLoading && !error && pagination.totalPages > 1 && <Pager page={page} totalPages={pagination.totalPages} onChange={setPage} />}
                </div>
              </section>
            </>
          )}
    </section>
  )
}
