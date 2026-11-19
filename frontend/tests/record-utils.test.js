import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllRecordPages } from '../src/features/shared/recordUtils.js'

test('fetches all pages from a wrapped paginated API response', async () => {
  const requestedPages = []
  const firstResponse = {
    success: true,
    data: {
      items: [{ id: 'case-1' }],
      pagination: { page: 1, totalPages: 3 },
    },
  }
  const records = await fetchAllRecordPages(async (page) => {
    requestedPages.push(page)
    return { data: { items: [{ id: `case-${page}` }], pagination: { page, totalPages: 3 } } }
  }, firstResponse, ['items'])

  assert.deepEqual(requestedPages, [2, 3])
  assert.deepEqual(records.map(({ id }) => id), ['case-1', 'case-2', 'case-3'])
})
