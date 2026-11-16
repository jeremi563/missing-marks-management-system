import { useEffect, useState } from 'react'
import { Building2, RefreshCw, Save } from 'lucide-react'
import { createAdminDepartment, getAdminDepartments, updateAdminDepartment } from '../../api/admin'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([])
  const [departmentNames, setDepartmentNames] = useState({})
  const [departmentInitials, setDepartmentInitials] = useState({})
  const [departmentCodes, setDepartmentCodes] = useState({})
  const [form, setForm] = useState({ name: '', initials: '', code: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    getAdminDepartments({ page: 1, limit: 100 }).then((departmentResponse) => {
      if (!active) return
      const loadedDepartments = extractRecords(departmentResponse, ['departments'])
      setDepartments(loadedDepartments)
      setDepartmentNames(Object.fromEntries(loadedDepartments.map((department) => [
        department.id,
        department.name,
      ])))
      setDepartmentInitials(Object.fromEntries(loadedDepartments.map((department) => [
        department.id,
        department.initials || '',
      ])))
      setDepartmentCodes(Object.fromEntries(loadedDepartments.map((department) => [
        department.id,
        department.code || '',
      ])))
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load departments.')
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
        initials: form.initials.trim(),
        ...(form.code.trim() ? { code: form.code.trim().toUpperCase() } : {}),
      })
      setForm({ name: '', initials: '', code: '' })
      setNotice('Department created.')
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to create the department.')
    } finally {
      setBusy('')
    }
  }

  const saveDepartment = async (department) => {
    const name = (departmentNames[department.id] || '').trim()
    const initials = (departmentInitials[department.id] || '').trim()
    const code = (departmentCodes[department.id] || '').trim().toUpperCase()
    if (!name) {
      setError('Department name is required.')
      return
    }
    if (!/^[A-Z]{2}$/.test(initials)) {
      setError('Department initials must be exactly two uppercase letters.')
      return
    }
    if (code.length > 50) {
      setError('Department code cannot exceed 50 characters.')
      return
    }
    setBusy(department.id)
    setError('')
    setNotice('')
    try {
      await updateAdminDepartment(department.id, { name, initials, code: code || null })
      setDepartments((current) => current.map((item) => item.id === department.id ? { ...item, name, initials, code: code || null } : item))
      setDepartmentNames((current) => ({ ...current, [department.id]: name }))
      setDepartmentInitials((current) => ({ ...current, [department.id]: initials }))
      setDepartmentCodes((current) => ({ ...current, [department.id]: code }))
      setNotice(`Department details updated for ${name}.`)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update department details.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="department-management">
      <header className="page-heading">
        <div><p className="eyebrow">DEPARTMENT SETUP</p><h2>Departments</h2><p>Create departments, set the student-number initials used to categorize students, and update department codes. CODs are promoted and assigned from the Lecturers page.</p></div>
        <button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
      <form className="panel" onSubmit={createDepartment}>
        <h3><Building2 size={18} /> Create department</h3>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="department-name">Department name</label><input id="department-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={200} required /></div>
          <div className="form-field"><label htmlFor="department-initials">Student-number initials</label><input id="department-initials" value={form.initials} onChange={(event) => setForm((current) => ({ ...current, initials: event.target.value.toUpperCase() }))} maxLength={2} pattern="[A-Z]{2}" title="Enter exactly two uppercase letters, such as IN." required /><small className="field-hint">Exactly two uppercase letters, such as IN.</small></div>
          <div className="form-field"><label htmlFor="department-code">Department code (optional)</label><input id="department-code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} maxLength={50} /></div>
        </div>
        <button className="button button-primary" type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create department'}</button>
      </form>

      <section className="panel department-list-panel">
        <div className="page-heading"><div><h3>Department configuration</h3><p>Department codes must be unique. Students are grouped by an exact, case-sensitive match at the start of their registration number.</p></div></div>
        {loading ? <LoadingState message="Loading departments…" /> :
          error && departments.length === 0 ? <ErrorState title="Unable to load departments" message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
            departments.length === 0 ? <EmptyState title="No departments yet" message="Create a department to configure student-number initials." /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Department name</th><th>Initials</th><th>Department code</th><th>Members</th><th>Action</th></tr></thead>
                  <tbody>{departments.map((department) => (
                    <tr key={department.id}>
                      <td><input aria-label={`Department name for ${department.name}`} value={departmentNames[department.id] ?? ''} onChange={(event) => setDepartmentNames((current) => ({ ...current, [department.id]: event.target.value }))} maxLength={200} required /></td>
                      <td><input aria-label={`Student-number initials for ${department.name}`} value={departmentInitials[department.id] ?? ''} onChange={(event) => setDepartmentInitials((current) => ({ ...current, [department.id]: event.target.value.toUpperCase() }))} maxLength={2} pattern="[A-Z]{2}" /></td>
                      <td><input aria-label={`Department code for ${department.name}`} value={departmentCodes[department.id] ?? ''} onChange={(event) => setDepartmentCodes((current) => ({ ...current, [department.id]: event.target.value.toUpperCase() }))} maxLength={50} /></td>
                      <td>{department._count?.members ?? 0}</td>
                      <td>
                        <button className="button button-secondary" type="button" disabled={Boolean(busy)} onClick={() => saveDepartment(department)}><Save size={15} />{busy === department.id ? 'Saving…' : 'Save changes'}</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
      </section>
    </section>
  )
}
