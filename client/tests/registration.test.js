import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRegistrationPayload } from '../src/features/auth/registration.js'

const registrationInput = {
  displayName: '  Morgan Student ',
  email: '  morgan@example.test ',
  password: 'a-long-enough-password',
  identityNumber: '  STU-001 ',
}

test('builds a student registration payload using studentNumber', () => {
  assert.deepEqual(buildRegistrationPayload({ ...registrationInput, role: 'student' }), {
    role: 'student',
    displayName: 'Morgan Student',
    email: 'morgan@example.test',
    password: 'a-long-enough-password',
    studentNumber: 'STU-001',
  })
})

test('builds lecturer and COD payloads using staffNumber', () => {
  for (const role of ['lecturer', 'cod']) {
    assert.deepEqual(buildRegistrationPayload({ ...registrationInput, role }), {
      role,
      displayName: 'Morgan Student',
      email: 'morgan@example.test',
      password: 'a-long-enough-password',
      staffNumber: 'STU-001',
    })
  }
})

test('rejects unsupported public account roles', () => {
  assert.throws(
    () => buildRegistrationPayload({ ...registrationInput, role: 'administrator' }),
    /supported account type/
  )
})
