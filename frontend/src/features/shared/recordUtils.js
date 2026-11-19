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

export function formatMarkValue(value) {
  if (value === null || value === undefined) return '—'
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && Number.isInteger(numericValue) ? String(numericValue) : value
}

export async function fetchAllRecordPages(fetchPage, firstResponse, collectionKeys = []) {
  const first = firstResponse?.data ?? firstResponse
  const payload = first?.data ?? first
  const totalPages = Math.max(1, Number(payload?.pagination?.totalPages) || 1)
  const records = extractRecords(firstResponse, collectionKeys)
  for (let page = 2; page <= totalPages; page += 1) {
    records.push(...extractRecords(await fetchPage(page), collectionKeys))
  }
  return records
}

export function groupCourseUnitsByCourse(courseUnits) {
  const groups = new Map()
  for (const courseUnit of courseUnits) {
    const course = courseUnit.course ?? null
    const key = course?.id ?? course?.code ?? 'unassigned'
    if (!groups.has(key)) groups.set(key, { course, courseUnits: [] })
    groups.get(key).courseUnits.push(courseUnit)
  }
  return [...groups.values()].sort((left, right) => {
    if (!left.course) return right.course ? 1 : 0
    if (!right.course) return -1
    return left.course.code.localeCompare(right.course.code)
  })
}
