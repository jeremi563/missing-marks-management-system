import { useEffect, useState } from 'react'
import { BookOpen, Check, RefreshCw, Search, UserPlus, UserRound, Users } from 'lucide-react'
import {
  assignCodLecturerToCourseUnit,
  getCodDepartmentCourseUnits,
  getCodDepartmentLecturers,
  getCodDepartments,
} from '../../api/cod'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { academicYearForDate } from '../../shared/academic-year'
import { extractRecords, groupCourseUnitsByCourse } from '../shared/recordUtils'
import './CodCourseUnitAssignments.css'

const LIST_LIMIT = 100

function unwrapItems(response) {
  const data = response?.data?.data ?? response?.data ?? response
  return Array.isArray(data?.items) ? data.items : extractRecords(response)
}

function lecturerName(lecturer) {
  return lecturer?.user?.displayName || lecturer?.user?.email || lecturer?.displayName || 'Lecturer'
}

export default function CodCourseUnitAssignments() {
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [courseUnits, setCourseUnits] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [loadedRequest, setLoadedRequest] = useState('')
  const [selectedLecturers, setSelectedLecturers] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyUnitId, setBusyUnitId] = useState('')
  const [refresh, setRefresh] = useState(0)
  const selectedDepartment = departments.find(({ id }) => id === departmentId)
  const currentAcademicYear = academicYearForDate(new Date())
  const requestKey = `${departmentId}:${refresh}`
  const isLoading = loading || Boolean(departmentId && loadedRequest !== requestKey)
  const assignedCount = courseUnits.filter((unit) => unit.lecturerMappings?.length).length
  const unassignedCount = courseUnits.length - assignedCount
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleCourseUnits = courseUnits.filter((unit) => {
    if (!normalizedSearch) return true
    return [
      unit.code,
      unit.name,
      unit.course?.code,
      unit.course?.name,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch))
  })
  const courseGroups = groupCourseUnitsByCourse(visibleCourseUnits)

  useEffect(() => {
    let active = true
    getCodDepartments()
      .then((response) => {
        if (!active) return
        const availableDepartments = extractRecords(response)
        setDepartments(availableDepartments)
        setDepartmentId((current) => current || availableDepartments[0]?.id || '')
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

  const refreshAssignments = () => {
    setError('')
    setCourseUnits([])
    setLecturers([])
    setLoadedRequest('')
    setRefresh((value) => value + 1)
  }

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
      refreshAssignments()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to assign this lecturer to the course unit.')
    } finally {
      setBusyUnitId('')
    }
  }

  const setDepartment = (nextDepartmentId) => {
    setDepartmentId(nextDepartmentId)
    setCourseUnits([])
    setLecturers([])
    setLoadedRequest('')
    setSelectedLecturers({})
    setSearchTerm('')
    setError('')
    setNotice('')
  }

  return (
    <section className="cod-unit-delegation">
      <header className="cod-unit-delegation__hero">
        <div>
          <p className="cod-unit-delegation__eyebrow">COD WORKSPACE / TEACHING COVERAGE</p>
          <h2>Unit delegation</h2>
          <p>Match each course unit with an eligible lecturer and keep your department’s teaching coverage current.</p>
        </div>
        <div className="cod-unit-delegation__hero-actions">
          <span className="cod-unit-delegation__year">Academic year <strong>{currentAcademicYear}</strong></span>
          <button
            className="button button-secondary"
            type="button"
            onClick={refreshAssignments}
            disabled={isLoading}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {notice && <div className="form-success" role="status">{notice}</div>}
      {error && courseUnits.length > 0 && <div className="form-alert" role="alert">{error}</div>}

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
          className="cod-unit-delegation__content"
          role={departments.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={departments.length > 1 ? `assignment-department-tab-${departmentId}` : undefined}
        >
          <div className="cod-unit-delegation__section-heading">
            <div>
              <p className="cod-unit-delegation__eyebrow">DEPARTMENT OVERVIEW</p>
              <h3>{selectedDepartment ? selectedDepartment.name : 'Department course units'}</h3>
            </div>
            <span className="cod-unit-delegation__lecturer-count">
              <Users size={16} /> {lecturers.length} eligible {lecturers.length === 1 ? 'lecturer' : 'lecturers'}
            </span>
          </div>

          {isLoading ? <LoadingState message="Loading unit assignments…" /> :
            error && courseUnits.length === 0 ? <ErrorState title="Unable to load assignments" message={error} onRetry={refreshAssignments} /> :
              courseUnits.length === 0 ? <EmptyState title="No course units found" message="Ask an administrator to create a course and add its course units before assigning lecturers." /> : (
                <>
                  <div className="cod-unit-delegation__summary" aria-label="Assignment summary">
                    <article>
                      <span className="cod-unit-delegation__summary-icon"><BookOpen size={18} /></span>
                      <div><strong>{courseUnits.length}</strong><span>Course units</span></div>
                    </article>
                    <article>
                      <span className="cod-unit-delegation__summary-icon is-assigned"><Check size={18} /></span>
                      <div><strong>{assignedCount}</strong><span>Assigned</span></div>
                    </article>
                    <article>
                      <span className="cod-unit-delegation__summary-icon is-open"><UserPlus size={18} /></span>
                      <div><strong>{unassignedCount}</strong><span>Needs assignment</span></div>
                    </article>
                    <article>
                      <span className="cod-unit-delegation__summary-icon is-lecturer"><Users size={18} /></span>
                      <div><strong>{lecturers.length}</strong><span>Eligible lecturers</span></div>
                    </article>
                  </div>

                  <div className="cod-unit-delegation__toolbar">
                    <label className="cod-unit-delegation__search">
                      <Search size={17} />
                      <input
                        type="search"
                        aria-label="Search course units"
                        placeholder="Search by unit code, name, or course…"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </label>
                    <span>Showing {visibleCourseUnits.length} of {courseUnits.length} units</span>
                  </div>

                  {visibleCourseUnits.length === 0 ? (
                    <EmptyState title="No matching course units" message="Try a different unit code, name, or course." />
                  ) : (
                    <div className="cod-unit-delegation__course-list">
                      {courseGroups.map(({ course, courseUnits: groupedUnits }) => (
                        <section className="cod-unit-course" key={course?.id ?? 'unassigned'}>
                          <header className="cod-unit-course__header">
                            <span className="cod-unit-course__icon"><BookOpen size={17} /></span>
                            <div>
                              <h4>{course ? `${course.code} — ${course.name}` : 'Course not assigned'}</h4>
                              <p>{groupedUnits.length} {groupedUnits.length === 1 ? 'course unit' : 'course units'}</p>
                            </div>
                          </header>

                          <div className="cod-unit-course__units">
                            {groupedUnits.map((courseUnit) => {
                              const mappings = courseUnit.lecturerMappings || []
                              const assignedLecturerIds = new Set(mappings.map(({ lecturer }) => lecturer?.id).filter(Boolean))
                              const availableLecturers = lecturers.filter(
                                ({ lecturerProfile }) => !assignedLecturerIds.has(lecturerProfile.id)
                              )
                              const currentLecturers = mappings.map(({ lecturer }) => lecturerName(lecturer)).join(', ')
                              const hasAssignment = mappings.length > 0
                              const unitCode = courseUnit.code || 'Course unit'

                              return (
                                <article className="cod-unit-row" key={courseUnit.id}>
                                  <div className="cod-unit-row__identity">
                                    <span className="cod-unit-row__code">{unitCode}</span>
                                    <div>
                                      <h5>{courseUnit.name || unitCode}</h5>
                                      <p>{hasAssignment ? 'Current assignment' : 'No lecturer assigned'}</p>
                                    </div>
                                  </div>
                                  <div className={`cod-unit-row__lecturer ${hasAssignment ? 'is-assigned' : 'is-unassigned'}`}>
                                    <UserRound size={16} />
                                    <span>{currentLecturers || 'Awaiting assignment'}</span>
                                  </div>
                                  <div className="cod-unit-row__actions">
                                    <select
                                      aria-label={`Lecturer for ${unitCode}`}
                                      value={selectedLecturers[courseUnit.id] || ''}
                                      onChange={(event) => setSelectedLecturers((current) => ({ ...current, [courseUnit.id]: event.target.value }))}
                                      disabled={!availableLecturers.length || busyUnitId === courseUnit.id}
                                    >
                                      <option value="">
                                        {hasAssignment ? 'Select replacement' : availableLecturers.length ? 'Select lecturer' : 'No eligible lecturers'}
                                      </option>
                                      {availableLecturers.map((lecturer) => (
                                        <option key={lecturer.lecturerProfile.id} value={lecturer.lecturerProfile.id}>
                                          {lecturer.displayName || lecturer.email}{lecturer.lecturerProfile.staffNumber ? ` · ${lecturer.lecturerProfile.staffNumber}` : ''}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      className="button button-primary"
                                      type="button"
                                      disabled={!selectedLecturers[courseUnit.id] || busyUnitId === courseUnit.id}
                                      onClick={() => assignLecturer(courseUnit)}
                                    >
                                      <UserPlus size={15} />
                                      {busyUnitId === courseUnit.id ? 'Saving…' : hasAssignment ? 'Replace' : 'Assign'}
                                    </button>
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}
        </section>
      )}
    </section>
  )
}
