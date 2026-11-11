import assert from 'node:assert/strict'
import test from 'node:test'
import { navigation } from '../src/config/navigation.js'

test('student navigation exposes implemented appeals and profile pages', () => {
  const destinations = navigation.student.map((item) => item.to)

  assert.ok(destinations.includes('/student/appeals'))
  assert.ok(destinations.includes('/student/profile'))
})