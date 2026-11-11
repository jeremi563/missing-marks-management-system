export default function StatusChip({ status }) {
  const value = String(status || 'unknown')
  const normalized = value.toLowerCase().replace(/[\s_]+/g, '-')
  return <span className={`status-chip status-${normalized}`}>{value.replace(/[_-]/g, ' ')}</span>
}
