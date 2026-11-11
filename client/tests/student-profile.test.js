import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStudentProfile } from '../src/features/student/profileData.js'

test('maps the backend student profile response to fields the page can display', () => {
  assert.deepEqual(normalizeStudentProfile({
    success: true,
    data: {
      id: 'profile-id',
      studentNumber: 'STU-001',
      officialEmail: null,
      notificationEmail: 'notice@example.test',
      user: {
        id: 'user-id',
        displayName: 'Morgan Student',
        email: 'morgan@example.test',
      },
    },
  }), {
    displayName: 'Morgan Student',
    email: 'morgan@example.test',
    studentNumber: 'STU-001',
    officialEmail: '',
    notificationEmail: 'notice@example.test',
  })
})

test('returns null for an empty or malformed profile response', () => {
  assert.equal(normalizeStudentProfile(null), null)
  assert.equal(normalizeStudentProfile({ data: null }), null)
})
