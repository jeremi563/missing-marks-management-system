import { useEffect, useState } from 'react'
import { Building2, RefreshCw, Save } from 'lucide-react'
import { addDepartmentMember, createAdminDepartment, getAdminDepartments, getAdminUsers, getDepartmentMembers, setDepartmentCod } from '../../api/admin'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([])
  const [codUsers, setCodUsers] = useState([])
  const [selectedCods, setSelectedCods] = useState({})
  const [form, setForm] = useState({ name: '', code: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      getAdminDepartments({ page: 1, limit: 100 }),
      getAdminUsers({ page: 1, limit: 100, role: 'cod', isActive: true }),
    ]).then(([departmentResponse, codResponse]) => {
      if (!active) return
      const loadedDepartments = extractRecords(departmentResponse, ['departments'])
      setDepartments(loadedDepartments)
      setCodUsers(extractRecords(codResponse, ['users']).filter((user) => user.roles?.includes('cod')))
      setSelectedCods(Object.fromEntries(loadedDepartments.map((department) => [
        department.id,
        department.designatedCodUserId || '',
      ])))
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load departments and COD accounts.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [refresh])

  const createDepartment = async (event) => {
    event.preventDefault()
    setBusy('create')
    setError('')
    setNotice('')
    try {
      await createAdminDepartment({
        name: form.name.trim(),
        ...(form.code.trim() ? { code: form.code.trim().toUpperCase() } : {}),
      })
      setForm({ name: '', code: '' })
      setNotice('Department created.')
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to create the department.')
    } finally {
      setBusy('')
    }
  }

  const assignCod = async (department) => {
    const codUserId = selectedCods[department.id]
    if (!codUserId) return
    setBusy(department.id)
    setError('')
    setNotice('')
    try {
      const membershipResponse = await getDepartmentMembers(department.id, { page: 1, limit: 100, role: 'cod' })
      const memberships = extractRecords(membershipResponse, ['members', 'departmentMembers'])
      const isMember = memberships.some((membership) =>
        membership.userId === codUserId || membership.user?.id === codUserId
      )
      if (!isMember) await addDepartmentMember(department.id, { userId: codUserId })
      await setDepartmentCod(department.id, { codUserId })
      setNotice(`Designated COD updated for ${department.name}.`)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to assign the department COD.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="department-management">
      <header className="page-heading">
        <div><p className="eyebrow">DEPARTMENT SETUP</p><h2>Departments and CODs</h2><p>Create departments and assign one active COD to each. Assigning a COD also adds them to that department.</p></div>
        <button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
      <form className="panel" onSubmit={createDepartment}>
        <h3><Building2 size={18} /> Create department</h3>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="department-name">Department name</label><input id="department-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={200} required /></div>
          <div className="form-field"><label htmlFor="department-code">Department code (optional)</label><input id="department-code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} maxLength={50} /></div>
        </div>
        <button className="button button-primary" type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create department'}</button>
      </form>

      <section className="panel department-list-panel">
        <div className="page-heading"><div><h3>Department COD assignments</h3><p>Each department has one designated COD responsible for lecturer approvals.</p></div></div>
        {loading ? <LoadingState message="Loading departments…" /> :
          error && departments.length === 0 ? <ErrorState title="Unable to load departments" message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
            departments.length === 0 ? <EmptyState title="No departments yet" message="Create a department to begin assigning CODs." /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Department</th><th>Members</th><th>Designated COD</th><th>Action</th></tr></thead>
                  <tbody>{departments.map((department) => (
                    <tr key={department.id}>
                      <td><strong>{department.name}</strong>{department.code && <small className="department-code">{department.code}</small>}</td>
                      <td>{department._count?.members ?? 0}</td>
                      <td>
                        <select
                          aria-label={`Designated COD for ${department.name}`}
                          value={selectedCods[department.id] ?? department.designatedCodUserId ?? ''}
                          onChange={(event) => setSelectedCods((current) => ({ ...current, [department.id]: event.target.value }))}
                        >
                          <option value="">Select a COD</option>
                          {codUsers.map((user) => <option value={user.id} key={user.id}>{user.displayName || user.email} · {user.email}</option>)}
                        </select>
                      </td>
                      <td><button className="button button-secondary" type="button" disabled={!selectedCods[department.id] || busy === department.id} onClick={() => assignCod(department)}><Save size={15} />{busy === department.id ? 'Saving…' : 'Assign COD'}</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                {codUsers.length === 0 && <p className="field-hint">No active COD accounts are available. Approve a lecturer, promote them to COD from All accounts, then assign them here.</p>}
              </div>
            )}
      </section>
    </section>
  )
}
