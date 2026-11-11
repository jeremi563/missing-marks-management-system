import { useCallback, useEffect, useState } from 'react'
import { getAdminSettings, updateAdminSetting } from '../../api/admin'
import { extractRecords } from '../shared/recordUtils'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminSettings() {
  const [settings, setSettings] = useState([])
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [refresh, setRefresh] = useState(0)
  const load = useCallback(async () => {
    const response = await getAdminSettings({ page: 1, limit: 100 })
    return extractRecords(response, ['settings'])
  }, [])
  useEffect(() => {
    let active = true
    load().then((records) => {
      if (!active) return
      setSettings(records)
      setValues(Object.fromEntries(records.map((setting) => [setting.key, setting.value])))
      setError('')
    }).catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load settings.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load, refresh])

  const save = async (setting) => {
    setBusyKey(setting.key)
    setError('')
    let value = values[setting.key]
    if (typeof setting.value !== 'string') {
      try {
        value = JSON.parse(String(value))
      } catch {
        setError(`Enter a valid JSON value for ${setting.key}.`)
        setBusyKey('')
        return
      }
    }
    try {
      await updateAdminSetting(setting.key, { value, ...(setting.description ? { description: setting.description } : {}) })
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || `Unable to update ${setting.key}.`)
    } finally {
      setBusyKey('')
    }
  }

  return (
    <section>
      <header className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h2>System settings</h2><p>Review and update configuration values.</p></div></header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {loading ? <LoadingState message="Loading settings…" /> : settings.length === 0 ? <EmptyState title="No settings available" message="Settings will appear here when configured." /> :
        <div className="records-grid">{settings.map((setting) => (
          <article className="record-card" key={setting.key}><div style={{ flex: 1 }}><h3>{setting.key}</h3>{setting.description && <p>{setting.description}</p>}<input aria-label={`Value for ${setting.key}`} value={typeof values[setting.key] === 'string' ? values[setting.key] : JSON.stringify(values[setting.key] ?? '')} onChange={(event) => setValues((current) => ({ ...current, [setting.key]: event.target.value }))} /></div><button className="button button-primary" disabled={busyKey === setting.key} onClick={() => save(setting)}>{busyKey === setting.key ? 'Saving…' : 'Save'}</button></article>
        ))}</div>}
      {!loading && error && <ErrorState title="Settings request failed" message={error} onRetry={() => setRefresh((value) => value + 1)} />}
    </section>
  )
}
