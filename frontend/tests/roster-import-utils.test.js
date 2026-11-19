import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRosterCsv, validateRosterRecords } from '../src/features/admin/roster-import-utils.js'

test('CSV parser supports quoted delimiters, escaped quotes, and a UTF-8 BOM', () => {
  const rows = parseRosterCsv('\uFEFFstudentNumber,fullName,email\r\nIN16/00111/26,"Taylor, ""T"" Student",student@example.test\r\n')
  assert.deepEqual(rows, [{
    sourceRow: 2,
    studentNumber: 'IN16/00111/26',
    fullName: 'Taylor, "T" Student',
    email: 'student@example.test',
  }])
})

test('CSV parser reports missing required columns and malformed quoting', () => {
  assert.throws(() => parseRosterCsv('studentNumber,fullName\nIN16/00111/26,Taylor\n'), /Required CSV columns/)
  assert.throws(() => parseRosterCsv('studentNumber,fullName,email\nIN16/00111/26,"Taylor,student@example.test\n'), /unclosed quoted field/)
})

test('preview validation identifies missing fields and every duplicate row', () => {
  const year = String(new Date().getFullYear() % 100).padStart(2, '0')
  const rows = validateRosterRecords([
    { sourceRow: 2, studentNumber: `IN16/00111/${year}`, fullName: 'Taylor Student', email: 'student@example.test' },
    { sourceRow: 3, studentNumber: `in16/00111/${year}`, fullName: 'Other Student', email: 'other@example.test' },
    { sourceRow: 4, studentNumber: `IN16/00112/${year}`, fullName: 'Missing email', email: '' },
  ])
  assert.equal(rows[0].status, 'INVALID')
  assert.equal(rows[1].status, 'INVALID')
  assert.equal(rows[0].issues.some((issue) => issue.includes('duplicated')), true)
  assert.equal(rows[2].status, 'INVALID')
  assert.ok(rows[2].issues.includes('Email is required.'))
})
