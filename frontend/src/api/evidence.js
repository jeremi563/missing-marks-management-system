import apiClient from './client'

export function withEvidenceFiles(data, files = []) {
  if (!files.length) return data
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value))
  })
  files.forEach((file) => formData.append('evidence', file, file.name))
  return formData
}

export async function downloadEvidenceFile(evidenceId, filename) {
  const response = await apiClient.get(`/evidence/${evidenceId}`, {
    responseType: 'blob',
    headers: { Accept: 'application/octet-stream' },
  })
  const objectUrl = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
