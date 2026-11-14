import { Fragment, useEffect, useState } from 'react'
import { RefreshCw, UserPlus } from 'lucide-react'
import {
  assignCodLecturerToCourseUnit,
  getCodDepartmentCourseUnits,
  getCodDepartmentLecturers,
  getCodDepartments,
} from '../../api/cod'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords, groupCourseUnitsByCourse } from '../shared/recordUtils'
import { academicYearForDate } from '../../shared/academic-year'

const LIST_LIMIT = 100

function getCurrentAcademicYear(now = new Date()) {
  return academicYearForDate(now)
}

function unwrapItems(response) {
  const data = response?.data?.data ?? response?.data ?? response
  return Array.isArray(data?.items) ? data.items : extractRecords(response)
}

export default function CodCourseUnitAssignments() {
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [courseUnits, setCourseUnits] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [loadedRequest, setLoadedRequest] = useState('')
  const [selectedLecturers, setSelectedLecturers] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyUnitId, setBusyUnitId] = useState('')
  const [refresh, setRefresh] = useState(0)
  const selectedDepartment = departments.find(({ id }) => id === departmentId)
  const currentAcademicYear = getCurrentAcademicYear()
  const requestKey = `${departmentId}:${refresh}`
  const isLoading = loading || Boolean(departmentId && loadedRequest !== requestKey)

  useEffect(() => {
    let active = true
    getCodDepartments()
      .then((response) => {
        if (!active) return
        const availableDepartments = extractRecords(response)
        setDepartments(availableDepartments)
        setDepartmentId((current) => current || availableDepartments[0]?.id || '')
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || 'Unable to load your designated departments.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (!departmentId) return undefined
    let active = true
    Promise.all([
      getCodDepartmentCourseUnits({ departmentId, page: 1, limit: LIST_LIMIT }),
      getCodDepartmentLecturers({ departmentId, page: 1, limit: LIST_LIMIT }),
    ]).then(([courseUnitResponse, lecturerResponse]) => {
      if (!active) return
      setCourseUnits(unwrapItems(courseUnitResponse))
      setLecturers(unwrapItems(lecturerResponse).filter((lecturer) => lecturer.lecturerProfile?.id))
      setError('')
      setLoadedRequest(requestKey)
    }).catch((requestError) => {
      if (!active) return
      setError(requestError.userMessage || 'Unable to load course units and lecturers for this department.')
      setLoadedRequest(requestKey)
    })
    return () => { active = false }
  }, [departmentId, refresh, requestKey])

  const assignLecturer = async (courseUnit) => {
    const lecturerProfileId = selectedLecturers[courseUnit.id]
    if (!lecturerProfileId) {
      setError('Select a lecturer before assigning the course unit.')
      return
    }
    setBusyUnitId(courseUnit.id)
    setError('')
    setNotice('')
    try {
      await assignCodLecturerToCourseUnit(courseUnit.id, { departmentId, lecturerProfileId })
      const lecturer = lecturers.find(({ lecturerProfile }) => lecturerProfile?.id === lecturerProfileId)
      setNotice(`${lecturer?.displayName || 'Lecturer'} assigned to ${courseUnit.code}.`)
      setSelectedLecturers((current) => ({ ...current, [courseUnit.id]: '' }))
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to assign this lecturer to the course unit.')
    } finally {
      setBusyUnitId('')
    }
  }

  const setDepartment = (nextDepartmentId) => {
    setDepartmentId(nextDepartmentId)
    setSelectedLecturers({})
    setNotice('')
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">COD WORKSPACE</p>
          <h2>Unit Delegation</h2>
          <p>Assign course units to active, approved lecturers in your designated department.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
      {departments.length > 1 && (
        <div className="lecturer-directory-tabs" role="tablist" aria-label="Select department for unit delegation">
          {departments.map((department) => (
            <button
              key={department.id}
              id={`assignment-department-tab-${department.id}`}
              className={`lecturer-directory-tab ${departmentId === department.id ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={departmentId === department.id}
              aria-controls="course-unit-assignment-panel"
              onClick={() => setDepartment(department.id)}
            >
              {department.code || department.name}
            </button>
          ))}
        </div>
      )}
      {!loading && departments.length === 0 && !error ? (
        <EmptyState title="No designated departments" message="You must be assigned as COD to a department before you can delegate course units." />
      ) : (
        <section
          id="course-unit-assignment-panel"
          className="panel"
          role={departments.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={departments.length > 1 ? `assignment-department-tab-${departmentId}` : undefined}
        >
          <div className="page-heading">
            <div>
              <h3>{selectedDepartment ? `${selectedDepartment.name} course units` : 'Department course units'}</h3>
              <p>Current academic year: <strong>{currentAcademicYear}</strong></p>
              <p>Course units are grouped by course and identified by code. Current assignments are shown for this academic year.</p>
            </div>
          </div>
          {isLoading ? <LoadingState message="Loading unit assignments…" /> :
            error ? <ErrorState title="Unable to load assignments" message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
              courseUnits.length === 0 ? <EmptyState title="No course units found" message="Ask an administrator to create a course and add its course units before assigning lecturers." /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Course unit code</th><th>Assigned lecturers</th><th>Assign lecturer</th><th>Action</th></tr></thead>
                    <tbody>{groupCourseUnitsByCourse(courseUnits).map(({ course, courseUnits: groupedUnits }) => (
                      <Fragment key={course?.id ?? 'unassigned'}>
                        <tr className="course-group-row">
                          <th colSpan="4" scope="rowgroup">
                            {course ? `${course.code} — ${course.name}` : 'Course not assigned'}
                          </th>
                        </tr>
                        {groupedUnits.map((courseUnit) => {
                          const assignedIds = courseUnit.lecturerMappings?.map(({ lecturer }) => lecturer.id) || []
                          const availableLecturers = lecturers.filter(({ lecturerProfile }) => !assignedIds.includes(lecturerProfile.id))
                          const hasCurrentYearAssignment = Boolean(courseUnit.lecturerMappings?.length)
                          return (
                            <tr key={courseUnit.id}>
                              <td><strong>{courseUnit.code}</strong></td>
                              <td>{courseUnit.lecturerMappings?.length
                                ? courseUnit.lecturerMappings.map(({ lecturer }) => lecturer.user.displayName || lecturer.user.email).join(', ')
                                : 'No lecturers assigned'}</td>
                              <td>
                                <select
                                  aria-label={`Lecturer for ${courseUnit.code}`}
                                  value={selectedLecturers[courseUnit.id] || ''}
                                  onChange={(event) => setSelectedLecturers((current) => ({ ...current, [courseUnit.id]: event.target.value }))}
                                  disabled={hasCurrentYearAssignment || !availableLecturers.length || busyUnitId === courseUnit.id}
                                >
                                  <option value="">{hasCurrentYearAssignment ? 'Already assigned this academic year' : availableLecturers.length ? 'Select lecturer' : 'No eligible lecturers'}</option>
                                  {availableLecturers.map((lecturer) => (
                                    <option key={lecturer.lecturerProfile.id} value={lecturer.lecturerProfile.id}>
                                      {lecturer.displayName || lecturer.email}{lecturer.lecturerProfile.staffNumber ? ` · ${lecturer.lecturerProfile.staffNumber}` : ''}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button
                                  className="button button-primary"
                                  type="button"
                                  disabled={hasCurrentYearAssignment || !selectedLecturers[courseUnit.id] || busyUnitId === courseUnit.id}
                                  onClick={() => assignLecturer(courseUnit)}
                                >
                                  <UserPlus size={15} />{busyUnitId === courseUnit.id ? 'Assigning…' : 'Assign'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}</tbody>
                  </table>
                </div>
              )}
        </section>
      )}
    </section>
  )
}
