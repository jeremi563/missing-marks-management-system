import { useCallback, useEffect, useState } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import {
  createAdminUser,
  deleteAdminStudent,
  getAdminDepartments,
  getAdminUsers,
  setDepartmentCod,
  updateAdminUser,
} from '../../api/admin'
import { useAuth } from '../../auth/useAuth'
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from '../../auth/password-policy'
import { extractRecords } from '../shared/recordUtils'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import ConfirmationDialog from '../../components/ui/ConfirmationDialog'

export default function AdminUsers({ roleFilter = null }) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [administratorCount, setAdministratorCount] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [loadedRequest, setLoadedRequest] = useState('')
  const [busyId, setBusyId] = useState('')
  const [studentToDelete, setStudentToDelete] = useState(null)
  const [studentToUpdate, setStudentToUpdate] = useState(null)
  const [studentNumberDraft, setStudentNumberDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ displayName: '', email: '', role: 'administrator', identity: '', password: '', departmentId: '' })
  const pageTitle = roleFilter === 'student' ? 'Students' : roleFilter === 'lecturer' ? 'Lecturers' : 'User accounts'
  const pageDescription = roleFilter === 'student'
    ? 'View and manage student accounts.'
    : roleFilter === 'lecturer'
      ? 'View and manage lecturer accounts, including lecturers assigned COD responsibility.'
      : 'Manage registered accounts. Review new lecturer requests on the approvals page.'
  const normalizedSearch = search.trim()
  const requestKey = `${roleFilter || 'all'}:${normalizedSearch}:${refresh}`

  const load = useCallback(async () => {
    const usersRequest = getAdminUsers({
      page: 1,
      limit: 100,
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(roleFilter === 'lecturer' ? { approvalStatus: 'APPROVED' } : {}),
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
    })
    if (roleFilter === 'lecturer' || roleFilter === 'student' || !roleFilter) {
      const requests = [
        usersRequest,
        getAdminDepartments({ page: 1, limit: 100 }),
        ...(!roleFilter ? [getAdminUsers({ page: 1, limit: 100, role: 'administrator' })] : []),
      ]
      const [usersResult, departmentsResult, administratorsResult] = await Promise.all(requests)
      return {
        users: extractRecords(usersResult, ['users']),
        departments: extractRecords(departmentsResult, ['departments']),
        administratorCount: administratorsResult ? extractRecords(administratorsResult, ['users']).length : null,
      }
    }
    return { users: extractRecords(await usersRequest, ['users']), departments: [], administratorCount: null }
  }, [roleFilter, normalizedSearch])

  useEffect(() => {
    let active = true
    load().then(({ users: loadedUsers, departments: loadedDepartments, administratorCount: loadedAdministratorCount }) => {
      if (!active) return
      setUsers(loadedUsers)
      setDepartments(loadedDepartments)
      if (loadedAdministratorCount !== null) setAdministratorCount(loadedAdministratorCount)
      setError('')
      setLoadedRequest(requestKey)
    }).catch((requestError) => {
      if (!active) return
      setError(requestError.userMessage || 'Unable to load user accounts.')
      setAdministratorCount(null)
      setLoadedRequest(requestKey)
    })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load, requestKey])

  const createUser = async (event) => {
    event.preventDefault()
    setError('')
    if (!meetsPasswordPolicy(form.password)) {
      setError(PASSWORD_POLICY_MESSAGE)
      return
    }
    if (form.role === 'administrator' && (loadedRequest !== requestKey || administratorCount === null || administratorCount >= 2)) {
      setError('The system can have at most two administrator accounts.')
      return
    }
    if (form.role === 'administrator') {
      const year = Number(form.identity.trim().split('/').at(-1))
      if (year > new Date().getFullYear()) {
        setError('The year in this registration number cannot be in the future.')
        return
      }
    }
    setCreating(true)
    const identityField = form.role === 'administrator' ? 'adminNumber' : 'staffNumber'
    try {
      await createAdminUser({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        password: form.password,
        roles: form.role === 'administrator' ? ['administrator'] : ['cod'],
        [identityField]: form.identity.trim(),
        ...(form.role === 'cod' ? { departmentId: form.departmentId } : {}),
      })
      setForm({ displayName: '', email: '', role: 'administrator', identity: '', password: '', departmentId: '' })
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to create the account.')
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (user) => {
    setBusyId(user.id)
    setError('')
    try {
      await updateAdminUser(user.id, { isActive: !user.isActive })
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update account status.')
    } finally {
      setBusyId('')
    }
  }

  const deleteStudent = async (user) => {
    setStudentToDelete(null)
    setBusyId(user.id)
    setError('')
    setNotice('')
    try {
      await deleteAdminStudent(user.id)
      setNotice(`${user.displayName || user.email} was deleted.`)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to delete this student.')
    } finally {
      setBusyId('')
    }
  }

  const updateStudentNumber = async (event) => {
    event.preventDefault()
    if (!studentToUpdate) return
    setBusyId(studentToUpdate.id)
    setError('')
    setNotice('')
    try {
      await updateAdminUser(studentToUpdate.id, { studentNumber: studentNumberDraft.trim() })
      setNotice(`${studentToUpdate.displayName || studentToUpdate.email}'s registration number was updated.`)
      setStudentToUpdate(null)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update this student number.')
    } finally {
      setBusyId('')
    }
  }

  const assignDepartmentCod = async (user, department) => {
    setBusyId(user.id)
    setError('')
    setNotice('')
    try {
      await setDepartmentCod(department.id, { codUserId: user.id })
      setNotice(`${user.displayName || user.email} is now the designated COD for ${department.code || 'the department'}.`)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to switch the department COD.')
    } finally {
      setBusyId('')
    }
  }

  const orderedUsers = [...users].sort((left, right) => {
    const leftRoles = Array.isArray(left.roles) ? left.roles : [left.role].filter(Boolean)
    const rightRoles = Array.isArray(right.roles) ? right.roles : [right.role].filter(Boolean)
    const leftIsCurrent = left.id === currentUser?.id
    const rightIsCurrent = right.id === currentUser?.id
    if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? -1 : 1
    const leftIsAdmin = leftRoles.includes('administrator')
    const rightIsAdmin = rightRoles.includes('administrator')
    return Number(rightIsAdmin) - Number(leftIsAdmin)
  })
  const activeDepartment = departments.find(({ id }) => id === selectedDepartment)
  const codDirectoryUsers = users
    .filter((user) => departments.some(({ designatedCodUserId }) => designatedCodUserId === user.id))
    .sort((left, right) => (left.displayName || left.email).localeCompare(right.displayName || right.email))
  const studentNumberFor = (user) =>
    user.studentProfile?.studentNumber || user.loginIdentifiers?.find(({ type }) => type === 'STUDENT_NUMBER')?.value
  const hasDepartmentInitials = (user, department) =>
    Boolean(department.initials && studentNumberFor(user)?.slice(0, 2) === department.initials)
  const visibleUsers = roleFilter === 'lecturer' && selectedDepartment === 'cods'
    ? codDirectoryUsers
    : roleFilter === 'lecturer' && activeDepartment
    ? users
      .filter((user) => user.departmentMemberships?.some(({ departmentId }) => departmentId === activeDepartment.id))
      .sort((left, right) => {
        const leftIsCod = activeDepartment.designatedCodUserId === left.id
        const rightIsCod = activeDepartment.designatedCodUserId === right.id
        if (leftIsCod !== rightIsCod) return leftIsCod ? -1 : 1
        return (left.displayName || left.email).localeCompare(right.displayName || right.email)
      })
    : roleFilter === 'student' && activeDepartment
      ? users.filter((user) => hasDepartmentInitials(user, activeDepartment))
    : roleFilter === 'lecturer' ? users : roleFilter ? users : orderedUsers

  return (
    <section>
      <header className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2>{pageTitle}</h2><p>{pageDescription}</p></div><button className="button button-secondary" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button></header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
      {!roleFilter && <form className="panel" onSubmit={createUser}>
        <h3>Create account</h3>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="new-user-role">Account type</label><select id="new-user-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, identity: '', departmentId: '' })}><option value="administrator" disabled={loadedRequest !== requestKey || administratorCount === null || administratorCount >= 2}>System administrator{administratorCount >= 2 ? ' (limit reached)' : ''}</option><option value="cod">Department COD</option></select>{form.role === 'administrator' && <small className="field-hint">{loadedRequest !== requestKey || administratorCount === null ? 'Checking administrator account limit…' : `${administratorCount} of 2 system administrator accounts created.`}</small>}</div>
          <div className="form-field"><label htmlFor="new-user-name">Full name</label><input id="new-user-name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required maxLength={200} /></div>
          <div className="form-field"><label htmlFor="new-user-email">Email</label><input id="new-user-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
          <div className="form-field"><label htmlFor="new-user-identity">{form.role === 'administrator' ? 'Administrator number' : 'Staff number'}</label><input id="new-user-identity" value={form.identity} onChange={(event) => setForm({ ...form, identity: event.target.value })} placeholder={form.role === 'administrator' ? 'admin/12/2026' : 'AB/0123/staffnumber'} pattern={form.role === 'administrator' ? 'admin/[0-9]{2}/[0-9]{4}' : '[A-Za-z]{2}/[0-9]{4}/(?:[A-Za-z0-9]|-)+'} title={form.role === 'administrator' ? 'Format: admin/12/year; year cannot be in the future.' : 'Format: AB/0123/staffnumber.'} required /><small className="field-hint">{form.role === 'administrator' ? 'Format: admin/12/year.' : 'Format: AB/0123/staffnumber.'}</small></div>
          {form.role === 'cod' && <div className="form-field"><label htmlFor="new-user-department">Department</label><select id="new-user-department" value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} required><option value="">Select a department</option>{departments.filter(({ designatedCodUserId }) => !designatedCodUserId).map((department) => <option value={department.id} key={department.id}>{department.name}{department.code ? ` (${department.code})` : ''}</option>)}</select><small className="field-hint">Only departments without a designated COD are available.</small></div>}
          <div className="form-field"><label htmlFor="new-user-password">Temporary password</label><input id="new-user-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} maxLength={128} required /><small className="field-hint">{PASSWORD_POLICY_MESSAGE}</small></div>
        </div>
        <button className="button button-primary" disabled={creating || (form.role === 'administrator' && (loadedRequest !== requestKey || administratorCount === null || administratorCount >= 2))}>{creating ? 'Creating…' : 'Create account'}</button>
      </form>}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="page-heading"><div><h3>{roleFilter ? `${pageTitle} directory` : 'All accounts'}</h3><p>Search registered accounts by name, email, role, or identifier.</p></div></div>
        <div className="toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users…" aria-label="Search users" /><span>{users.length} user(s)</span></div>
        {(roleFilter === 'lecturer' || roleFilter === 'student') && <div className="lecturer-directory-tabs" role="tablist" aria-label={`${pageTitle} by department`}>
          <button id={`${roleFilter}-directory-tab-all`} className={`lecturer-directory-tab ${selectedDepartment === 'all' ? 'active' : ''}`} type="button" role="tab" aria-selected={selectedDepartment === 'all'} aria-controls={`${roleFilter}-directory-panel`} onClick={() => setSelectedDepartment('all')}>
            <span>All {roleFilter === 'lecturer' ? 'lecturers' : 'students'}</span><small>{users.length}</small>
          </button>
          {departments.map((department) => {
            const count = users.filter((user) => roleFilter === 'lecturer'
              ? user.departmentMemberships?.some(({ departmentId }) => departmentId === department.id)
              : hasDepartmentInitials(user, department)).length
            return <button key={department.id} id={`${roleFilter}-directory-tab-${department.id}`} className={`lecturer-directory-tab ${selectedDepartment === department.id ? 'active' : ''}`} type="button" role="tab" aria-selected={selectedDepartment === department.id} aria-controls={`${roleFilter}-directory-panel`} onClick={() => setSelectedDepartment(department.id)}>
              <span>{roleFilter === 'lecturer' || roleFilter === 'student' ? department.code || '—' : department.name}</span><small>{count}</small>
            </button>
          })}
          {roleFilter === 'lecturer' && <button id="lecturer-directory-tab-cods" className={`lecturer-directory-tab ${selectedDepartment === 'cods' ? 'active' : ''}`} type="button" role="tab" aria-selected={selectedDepartment === 'cods'} aria-controls="lecturer-directory-panel" onClick={() => setSelectedDepartment('cods')}>
            <span>All CODs</span><small>{codDirectoryUsers.length}</small>
          </button>}
        </div>}
        {loading || loadedRequest !== requestKey ? <LoadingState message={`Loading ${pageTitle.toLowerCase()}…`} /> : error ? <ErrorState title={`Unable to load ${pageTitle.toLowerCase()}`} message={error} onRetry={() => setRefresh((value) => value + 1)} /> : users.length === 0 ? <EmptyState title={`No ${roleFilter ? pageTitle.toLowerCase() : 'accounts'} found`} message="Try a different search." /> : (roleFilter === 'lecturer' || roleFilter === 'student') && ((selectedDepartment === 'cods' && codDirectoryUsers.length === 0) || (activeDepartment && visibleUsers.length === 0)) ? <EmptyState title={selectedDepartment === 'cods' ? 'No designated CODs' : `No ${roleFilter === 'student' ? 'students' : 'lecturers'} in ${roleFilter === 'lecturer' ? activeDepartment?.code || 'this department' : activeDepartment?.name}`} message={selectedDepartment === 'cods' ? 'Designated COD accounts will appear here with their departments.' : roleFilter === 'student' ? `Students with registration numbers starting with ${activeDepartment?.initials || 'the department initials'} will appear here.` : 'Lecturers appear here after they join this department.'} /> : (
          <div id={roleFilter === 'lecturer' || roleFilter === 'student' ? `${roleFilter}-directory-panel` : undefined} role={roleFilter === 'lecturer' || roleFilter === 'student' ? 'tabpanel' : undefined} aria-labelledby={roleFilter === 'lecturer' || roleFilter === 'student' ? selectedDepartment === 'all' ? `${roleFilter}-directory-tab-all` : selectedDepartment === 'cods' ? 'lecturer-directory-tab-cods' : `${roleFilter}-directory-tab-${selectedDepartment}` : undefined} className="table-wrap"><table><thead><tr><th>Name</th>{roleFilter && <th>{roleFilter === 'student' ? 'Registration number' : 'Staff number'}</th>}{roleFilter === 'lecturer' && selectedDepartment === 'cods' && <th>Department(s)</th>}<th>Email</th><th>Role</th><th>Status</th>{roleFilter === 'lecturer' && selectedDepartment !== 'cods' && <th>Sign-in readiness</th>}{selectedDepartment !== 'cods' && <th>Action</th>}</tr></thead><tbody>{visibleUsers.map((user) => {
            const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean)
            const identifier = roleFilter === 'student'
              ? user.studentProfile?.studentNumber || user.loginIdentifiers?.find(({ type }) => type === 'STUDENT_NUMBER')?.value
              : user.lecturerProfile?.staffNumber || user.loginIdentifiers?.find(({ type }) => type === 'STAFF_NUMBER')?.value
            const isStaff = roles.includes('lecturer') || roles.includes('cod')
            const isSelfAdmin = user.id === currentUser?.id && roles.includes('administrator')
            const canActivate = !isStaff || user.approvalStatus === 'APPROVED'
            const hasDepartmentRegistration = Boolean(user.departmentMemberships?.length)
            const readiness = user.approvalStatus !== 'APPROVED'
              ? hasDepartmentRegistration ? 'Pending department COD approval' : 'Awaiting department registration'
              : user.isActive
                ? 'Ready to sign in'
                : 'Approved; inactive'
            const isCurrentDepartmentCod = activeDepartment?.designatedCodUserId === user.id
            const isDesignatedCod = departments.some(({ designatedCodUserId }) => designatedCodUserId === user.id)
            const designatedDepartmentCodes = departments
              .filter(({ designatedCodUserId }) => designatedCodUserId === user.id)
              .map(({ code }) => code || '—')
            const deactivationBlocked = user.isActive && (isSelfAdmin || isDesignatedCod)
            const deactivationTitle = isSelfAdmin && user.isActive
              ? 'You cannot deactivate your own administrator account.'
              : isDesignatedCod && user.isActive
                ? 'Switch the designated COD before deactivating this account.'
                : undefined
            return <tr key={user.id}><td>{user.displayName || user.fullName || '—'}{isSelfAdmin && <small className="account-self-label">You</small>}</td>{roleFilter && <td>{identifier || '—'}</td>}{roleFilter === 'lecturer' && selectedDepartment === 'cods' && <td>{designatedDepartmentCodes.join(', ')}</td>}<td>{user.email}</td><td>{roles.includes('administrator') ? 'Administrator' : roles.includes('cod') ? 'COD' : roles.join(', ') || '—'}</td><td>{user.isActive ? 'Active' : 'Inactive'}</td>{roleFilter === 'lecturer' && selectedDepartment !== 'cods' && <td>{readiness}</td>}{selectedDepartment !== 'cods' && <td><div className="record-actions">{roleFilter === 'lecturer' && activeDepartment && <button className="button button-secondary" type="button" disabled={busyId === user.id || isCurrentDepartmentCod || !user.isActive || user.approvalStatus !== 'APPROVED'} onClick={() => assignDepartmentCod(user, activeDepartment)}>{busyId === user.id ? 'Switching…' : isCurrentDepartmentCod ? 'Current COD' : activeDepartment.designatedCodUserId ? 'Reassign COD' : 'Make COD'}</button>}{(canActivate || user.isActive) && <button className="button button-secondary" disabled={busyId === user.id || deactivationBlocked} title={deactivationTitle} onClick={() => toggleActive(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button>}{roleFilter === 'student' && <><button className="button button-secondary" disabled={busyId === user.id} title="Update the student's course-coded registration number" onClick={() => { setStudentToUpdate(user); setStudentNumberDraft(studentNumberFor(user) || '') }}><Pencil size={15} /> Update number</button><button className="button button-secondary" disabled={busyId === user.id} title="Permanently delete this student account" onClick={() => setStudentToDelete(user)}><Trash2 size={15} /> Delete</button></>}</div></td>}</tr>
          })}</tbody></table></div>
        )}
      </section>
      {studentToUpdate && (
        <dialog open className="panel admin-edit-dialog" aria-labelledby="student-number-title">
          <header className="page-heading">
            <div>
              <p className="eyebrow">STUDENT IDENTITY</p>
              <h2 id="student-number-title">Update registration number</h2>
              <p>Use the department initials, two-digit course identifier, five-digit unique number, and admission year.</p>
            </div>
          </header>
          <form className="form-stack" onSubmit={updateStudentNumber}>
            <div className="form-field">
              <label htmlFor="student-number">Registration number</label>
              <input id="student-number" value={studentNumberDraft} onChange={(event) => setStudentNumberDraft(event.target.value)} placeholder="IN16/00111/26" pattern="[A-Za-z]{2}[0-9]{2}/[0-9]{5}/[0-9]{2}" maxLength={13} required />
              <small>The course must already exist in the department identified by the first two letters. Admission year must be from 13 through the current year.</small>
            </div>
            <div className="record-actions">
              <button className="button button-secondary" type="button" onClick={() => setStudentToUpdate(null)} disabled={busyId === studentToUpdate.id}>Cancel</button>
              <button className="button button-primary" type="submit" disabled={busyId === studentToUpdate.id || !studentNumberDraft.trim()}>{busyId === studentToUpdate.id ? 'Saving…' : 'Save registration number'}</button>
            </div>
          </form>
        </dialog>
      )}
      {studentToDelete && (
        <ConfirmationDialog
          title="Delete student account?"
          description={`Permanently delete ${studentToDelete.displayName || studentToDelete.email}${studentNumberFor(studentToDelete) ? ` (${studentNumberFor(studentToDelete)})` : ''}? Students with academic records cannot be deleted.`}
          confirmLabel="Delete student"
          destructive
          onCancel={() => setStudentToDelete(null)}
          onConfirm={() => deleteStudent(studentToDelete)}
        />
      )}
    </section>
  )
}
