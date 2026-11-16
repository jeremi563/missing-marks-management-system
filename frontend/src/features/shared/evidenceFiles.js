const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_FILES = 3
const mimeByExtension = new Map([
  ['pdf', 'application/pdf'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
])

export function validateEvidenceSelection(files) {
  if (files.length > MAX_FILES) return 'Attach no more than three files.'
  for (const file of files) {
    const extension = file.name.split('.').at(-1)?.toLowerCase()
    const expectedMime = mimeByExtension.get(extension)
    if (!expectedMime) return 'Evidence must be a PDF, JPG, JPEG, PNG or DOCX file.'
    if (file.type && file.type.toLowerCase() !== expectedMime) return `${file.name} has a file type that does not match its extension.`
    if (file.size > MAX_FILE_BYTES) return 'Each evidence file must be no larger than 5 MB.'
  }
  return ''
}

export function formatEvidenceSize(sizeBytes) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`
}
