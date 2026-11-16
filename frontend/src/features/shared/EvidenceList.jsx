import { useState } from 'react'
import { Download } from 'lucide-react'
import { downloadEvidenceFile } from '../../api/evidence'
import { formatEvidenceSize } from './evidenceFiles'

export default function EvidenceList({ evidence = [], title = 'Evidence' }) {
  const [downloadingId, setDownloadingId] = useState('')
  const [error, setError] = useState('')
  if (!evidence.length) return null

  const download = async (item) => {
    setDownloadingId(item.id)
    setError('')
    try {
      await downloadEvidenceFile(item.id, item.originalName)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to download this evidence file.')
    } finally {
      setDownloadingId('')
    }
  }

  return (
    <section className="details-card" aria-label={title}>
      <h3>{title}</h3>
      <ul className="evidence-list">
        {evidence.map((item) => (
          <li key={item.id}>
            <span>{item.originalName} · {formatEvidenceSize(item.sizeBytes)}</span>
            <button className="button button-secondary" type="button" disabled={Boolean(downloadingId)} onClick={() => download(item)}>
              <Download size={15} />{downloadingId === item.id ? 'Downloading…' : 'Download'}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="form-alert" role="alert">{error}</p>}
    </section>
  )
}
