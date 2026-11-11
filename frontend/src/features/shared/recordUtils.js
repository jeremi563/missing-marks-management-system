export function extractRecords(response, collectionKeys = []) {
  const first = response?.data ?? response
  const data = first?.data ?? first
  if (Array.isArray(data)) return data
  for (const key of collectionKeys) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.rows)) return data.rows
  return []
}
