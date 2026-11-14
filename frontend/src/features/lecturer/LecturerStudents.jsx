import { useEffect, useMemo, useState } from 'react'
import { Building2, Check, RefreshCw } from 'lucide-react'
import { getLecturerDepartments, getLecturerStudents } from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import Pager from '../../components/ui/Pager'
import { extractRecords } from '../shared/recordUtils'
import './LecturerStudents.css'

const PAGE_SIZE = 20

function unwrapAssignedDepartments(response) {
  const data = response?.data ?? response
  if (!data || !Array.isArray(data.assignedDepartments)) {
    throw new Error('The server returned invalid assigned departments.')
  }
  return data.assignedDepartments
}

export default function LecturerStudents() {
  const [students, setStudents] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [assignedDepartments, setAssignedDepartments] = useState([])
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [departmentError, setDepartmentError] = useState('')
  const [loading, setLoading] = useState(true)
  const [departmentLoading, setDepartmentLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    getLecturerDepartments()
      .then((response) => {
        if (!active) return
        setAssignedDepartments(unwrapAssignedDepartments(response))
        setDepartmentError('')
      })
      .catch((requestError) => {
        if (active) setDepartmentError(requestError.userMessage || requestError.message || 'Unable to load department options.')
      })
      .finally(() => {
        if (active) setDepartmentLoading(false)
      })
    return () => { active = false }
  }, [refresh])

  const departmentFilter = selectedDepartmentIds === null
    ? undefined
    : selectedDepartmentIds.join(',')

  useEffect(() => {
    let active = true
    getLecturerStudents({
      page,
      limit: PAGE_SIZE,
      ...(departmentFilter !== undefined ? { departmentIds: departmentFilter } : {}),
    })
      .then((response) => {
        if (!active) return
        setStudents(extractRecords(response))
        setPagination(response?.pagination ?? { page, totalPages: 1, total: 0 })
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || 'Unable to load students in your course units.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [page, refresh, departmentFilter])

  const groupedStudents = useMemo(() => {
    const groups = new Map()
    students.forEach((enrollment) => {
      const { courseUnit } = enrollment
      if (!groups.has(courseUnit.id)) groups.set(courseUnit.id, { courseUnit, enrollments: [] })
      groups.get(courseUnit.id).enrollments.push(enrollment)
    })
    return [...groups.values()]
  }, [students])

  const toggleDepartmentFilter = (departmentId) => {
    setLoading(true)
    setSelectedDepartmentIds((current) => {
      const selected = current === null ? assignedDepartments.map(({ id }) => id) : current
      return selected.includes(departmentId)
        ? selected.filter((id) => id !== departmentId)
        : [...selected, departmentId]
    })
    setPage(1)
  }

  const changePage = (nextPage) => {
    setLoading(true)
    setPage(nextPage)
  }

  const retry = () => {
    setError('')
    setDepartmentError('')
    setLoading(true)
    setDepartmentLoading(true)
    setRefresh((value) => value + 1)
  }

  const selectedIds = selectedDepartmentIds ?? assignedDepartments.map(({ id }) => id)
  const allDepartmentsSelected = assignedDepartments.length > 0 && selectedIds.length === assignedDepartments.length
  const departmentSelectionLabel = departmentLoading
    ? 'Loading departments…'
    : allDepartmentsSelected
      ? `All ${assignedDepartments.length} departments`
      : `${selectedIds.length} of ${assignedDepartments.length} departments`

  const selectDepartments = (departmentIds) => {
    setLoading(true)
    setSelectedDepartmentIds(departmentIds)
    setPage(1)
  }

  return (
    <section className="lecturer-students-page">
      <header className="page-heading lecturer-students-heading">
        <div>
          <p className="eyebrow">LECTURER PORTAL</p>
          <h2>My students</h2>
          <p>See students enrolled in your assigned course units, grouped by course.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={retry}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <section className="lecturer-students-groups" aria-labelledby="enrolled-students-title">
        {departmentError && !departmentLoading && <div className="form-alert" role="alert">{departmentError}</div>}
        {!departmentLoading && assignedDepartments.length > 1 && <section className="lecturer-department-filter-panel" aria-labelledby="lecturer-department-filter-title">
          <header className="lecturer-department-filter-header">
            <div className="lecturer-department-filter-title">
              <span className="lecturer-department-filter-icon" aria-hidden="true"><Building2 size={18} /></span>
              <div>
                <h3 id="lecturer-department-filter-title">Filter by department</h3>
                <p>Select one or more departments to narrow your student list.</p>
              </div>
            </div>
            <div className="lecturer-department-filter-controls">
              <span className="lecturer-department-selection-count" role="status">{departmentSelectionLabel}</span>
              <button
                className="lecturer-department-action"
                type="button"
                disabled={departmentLoading || assignedDepartments.length === 0 || allDepartmentsSelected}
                onClick={() => selectDepartments(assignedDepartments.map(({ id }) => id))}
              >
                Select all
              </button>
              <button
                className="lecturer-department-action"
                type="button"
                disabled={departmentLoading || selectedIds.length === 0}
                onClick={() => selectDepartments([])}
              >
                Clear
              </button>
            </div>
          </header>
          {departmentLoading ? (
            <p className="lecturer-department-filter-message">Loading your assigned departments…</p>
          ) : assignedDepartments.length === 0 ? (
            <p className="lecturer-department-filter-message">No assigned departments are available to filter.</p>
          ) : (
            <fieldset className="lecturer-department-filters" disabled={departmentLoading}>
              <legend className="sr-only">Choose departments</legend>
              {assignedDepartments.map((department) => {
                const isSelected = selectedIds.includes(department.id)
                return (
                  <label className={`lecturer-department-option${isSelected ? ' selected' : ''}`} key={department.id}>
                    <input
                      type="checkbox"
                      aria-label={`${department.code || ''} ${department.name}`}
                      checked={isSelected}
                      onChange={() => toggleDepartmentFilter(department.id)}
                    />
                    <span className="lecturer-department-check" aria-hidden="true">{isSelected && <Check size={14} />}</span>
                    <span className="lecturer-department-code">{department.code || '—'}</span>
                    <span className="lecturer-department-name">{department.name}</span>
                  </label>
                )
              })}
            </fieldset>
          )}
        </section>}
        <div className="lecturer-student-list-heading">
          <div>
            <p className="eyebrow">STUDENT ROSTER</p>
            <h3 id="enrolled-students-title">Enrolled students by course</h3>
            <p>{pagination.total} enrollment(s) {assignedDepartments.length > 1
              ? `across ${selectedIds.length} selected department${selectedIds.length === 1 ? '' : 's'}.`
              : 'in your assigned course units.'}</p>
          </div>
        </div>
        {loading ? <LoadingState message="Loading your students…" /> :
          error ? <ErrorState title="Unable to load students" message={error} onRetry={retry} /> :
            !selectedIds.length ? <EmptyState title="Select a department" message="Choose at least one assigned department to view its course enrollments." /> :
              students.length === 0 ? (
                <EmptyState title="No enrolled students" message="Students enrolled in your assigned course units will appear here." />
              ) : (
                <>
                  {groupedStudents.map(({ courseUnit, enrollments }) => (
                    <section className="lecturer-course-student-group" key={courseUnit.id} aria-label={`${courseUnit.code} enrolled students`}>
                      <header>
                        <div><h4>{courseUnit.code} · {courseUnit.name}</h4><small>{courseUnit.department.name}</small></div>
                        <span>{enrollments.length} on this page</span>
                      </header>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Student name</th><th>Registration number</th><th>Email</th><th>Academic period</th></tr></thead>
                          <tbody>
                            {enrollments.map(({ id, student, academicPeriod }) => (
                              <tr key={id}>
                                <td>{student.user?.displayName || '—'}</td>
                                <td>{student.studentNumber}</td>
                                <td>{student.officialEmail || student.user?.email || '—'}</td>
                                <td>{academicPeriod.code || academicPeriod.name}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                  {pagination.totalPages > 1 && <Pager page={page} totalPages={pagination.totalPages} onChange={changePage} />}
                </>
              )}
      </section>
    </section>
  )
}
