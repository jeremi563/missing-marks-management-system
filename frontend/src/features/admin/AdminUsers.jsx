import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import {
  createAdminUser,
  getAdminDepartments,
  getAdminUsers,
  updateAdminUser,
} from '../../api/admin'
import { extractRecords } from '../shared/recordUtils'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminUsers({ roleFilter = null }) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [codDepartmentSelections, setCodDepartmentSelections] = useState({})
  const [loadedRequest, setLoadedRequest] = useState('')
  const [busyId, setBusyId] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ displayName: '', email: '', role: 'student', identity: '', password: '' })
  const pageTitle = roleFilter === 'student' ? 'Students' : roleFilter === 'lecturer' ? 'Lecturers' : 'User accounts'
  const pageDescription = roleFilter === 'student'
    ? 'View and manage student accounts.'
    : roleFilter === 'lecturer'
      ? 'View and manage lecturer accounts, including lecturers assigned COD responsibility.'
      : 'Manage registered accounts. Review new lecturer requests on the approvals page.'
  const normalizedSearch = search.trim()
  const requestKey = `${roleFilter || 'all'}:${normalizedSearch}:${refresh}`

  const load = useCallback(async () => {
    const result = await getAdminUsers({
      page: 1,
      limit: 100,
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(roleFilter === 'lecturer' ? { approvalStatus: 'APPROVED' } : {}),
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
    })
    return extractRecords(result, ['users'])
  }, [roleFilter, normalizedSearch])

  useEffect(() => {
    let active = true
    load().then((data) => {
      if (!active) return
      setUsers(data)
      setError('')
      setLoadedRequest(requestKey)
    }).catch((requestError) => {
      if (!active) return
      setError(requestError.userMessage || 'Unable to load user accounts.')
      setLoadedRequest(requestKey)
    })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load, requestKey])

  useEffect(() => {
    let active = true
    getAdminDepartments({ page: 1, limit: 100 }).then((response) => {
      if (!active) return
      setDepartments(extractRecords(response, ['departments']))
    }).catch(() => {
      if (active) setDepartments([])
    })
    return () => { active = false }
  }, [])

  const createUser = async (event) => {
    event.preventDefault()
    setError('')
    if (form.role === 'student' || form.role === 'administrator') {
      const year = Number(form.identity.trim().split('/').at(-1))
      if (year > new Date().getFullYear()) {
        setError('The year in this registration number cannot be in the future.')
        return
      }
    }
    setCreating(true)
    const identityField = form.role === 'student' ? 'studentNumber' : form.role === 'administrator' ? 'adminNumber' : 'staffNumber'
    try {
      await createAdminUser({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        password: form.password,
        roles: [form.role],
        [identityField]: form.identity.trim(),
      })
      setForm({ displayName: '', email: '', role: 'student', identity: '', password: '' })
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

  const promoteToCod = async (user) => {
    const departmentId = codDepartmentSelections[user.id]
    if (!departmentId) {
      setError('Choose a department before assigning COD responsibility.')
      return
    }
    setBusyId(user.id)
    setError('')
    try {
      await updateAdminUser(user.id, { roles: ['lecturer', 'cod'], departmentId })
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to assign COD role.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section>
      <header className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2>{pageTitle}</h2><p>{pageDescription}</p></div><button className="button button-secondary" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button></header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {!roleFilter && <form className="panel" onSubmit={createUser}>
        <h3>Create account</h3>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="new-user-name">Full name</label><input id="new-user-name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required maxLength={200} /></div>
          <div className="form-field"><label htmlFor="new-user-email">Email</label><input id="new-user-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
          <div className="form-field"><label htmlFor="new-user-role">Role</label><select id="new-user-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, identity: '' })}><option value="student">Student</option><option value="lecturer">Lecturer</option><option value="administrator">Administrator</option></select></div>
          <div className="form-field"><label htmlFor="new-user-identity">{form.role === 'student' ? 'Registration number' : form.role === 'administrator' ? 'Administrator number' : 'Staff number'}</label><input id="new-user-identity" value={form.identity} onChange={(event) => setForm({ ...form, identity: event.target.value })} placeholder={form.role === 'student' ? 'AB/01243/2026' : form.role === 'administrator' ? 'admin/12/2026' : 'AB/0123/staffnumber'} pattern={form.role === 'student' ? '[A-Za-z]{2}/[0-9]{5}/[0-9]{4}' : form.role === 'administrator' ? 'admin/[0-9]{2}/[0-9]{4}' : '[A-Za-z]{2}/[0-9]{4}/(?:[A-Za-z0-9]|-)+'} title={form.role === 'student' ? 'Format: AB/01243/year; year cannot be in the future.' : form.role === 'administrator' ? 'Format: admin/12/year; year cannot be in the future.' : 'Format: AB/0123/staffnumber.'} required /><small className="field-hint">{form.role === 'student' ? 'Format: AB/01243/year.' : form.role === 'administrator' ? 'Format: admin/12/year.' : 'Format: AB/0123/staffnumber.'}</small></div>
          <div className="form-field"><label htmlFor="new-user-password">Temporary password</label><input id="new-user-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} required /><small className="field-hint">At least 8 characters.</small></div>
        </div>
        <button className="button button-primary" disabled={creating}>{creating ? 'Creating…' : 'Create account'}</button>
      </form>}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="page-heading"><div><h3>{roleFilter ? `${pageTitle} directory` : 'All accounts'}</h3><p>Search registered accounts by name, email, role, or identifier.</p></div></div>
        <div className="toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users…" aria-label="Search users" /><span>{users.length} user(s)</span></div>
        {loading || loadedRequest !== requestKey ? <LoadingState message={`Loading ${pageTitle.toLowerCase()}…`} /> : error ? <ErrorState title={`Unable to load ${pageTitle.toLowerCase()}`} message={error} onRetry={() => setRefresh((value) => value + 1)} /> : users.length === 0 ? <EmptyState title={`No ${roleFilter ? pageTitle.toLowerCase() : 'accounts'} found`} message="Try a different search." /> : (
          <div className="table-wrap"><table><thead><tr><th>Name</th>{roleFilter && <th>{roleFilter === 'student' ? 'Registration number' : 'Staff number'}</th>}<th>Email</th><th>Role</th><th>Status</th>{roleFilter === 'lecturer' && <th>Sign-in readiness</th>}<th>Action</th></tr></thead><tbody>{users.map((user) => {
            const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean)
            const canPromoteToCod = roles.includes('lecturer') && !roles.includes('cod') && !roles.includes('student') && user.approvalStatus === 'APPROVED' && user.isActive
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
            return <tr key={user.id}><td>{user.displayName || user.fullName || '—'}{isSelfAdmin && <small className="account-self-label">You</small>}</td>{roleFilter && <td>{identifier || '—'}</td>}<td>{user.email}</td><td>{roles.join(', ') || '—'}</td><td>{user.isActive ? 'Active' : 'Inactive'}</td>{roleFilter === 'lecturer' && <td>{readiness}</td>}<td><div className="record-actions">{canPromoteToCod && <div className="cod-assignment-row"><select value={codDepartmentSelections[user.id] ?? ''} onChange={(event) => setCodDepartmentSelections((current) => ({ ...current, [user.id]: event.target.value }))} aria-label={`Department for ${user.displayName || user.email} COD assignment`} className="input-sm"><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><button className="button button-secondary" disabled={busyId === user.id || !codDepartmentSelections[user.id]} onClick={() => promoteToCod(user)}><ShieldCheck size={15} /> Make COD</button></div>}{isStaff && !canActivate && hasDepartmentRegistration && <Link className="button button-secondary" to="/admin/approvals">Review approval</Link>}{(canActivate || user.isActive) && <button className="button button-secondary" disabled={busyId === user.id || (isSelfAdmin && user.isActive)} title={isSelfAdmin && user.isActive ? 'You cannot deactivate your own administrator account.' : undefined} onClick={() => toggleActive(user)}>{user.isActive ? isSelfAdmin ? 'Your account' : 'Deactivate' : 'Activate'}</button>}</div></td></tr>
          })}</tbody></table></div>
        )}
      </section>
    </section>
  )
}
