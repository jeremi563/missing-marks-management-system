import assert from 'node:assert/strict'
import test from 'node:test'
import { getApiErrorMessage } from '../src/api/errorHandler.js'

test('explains that the API server is unavailable for a 502 response', () => {
  assert.equal(
    getApiErrorMessage({ response: { status: 502, data: {} } }),
    'The application server is unavailable. Please try again shortly.'
  )
})

test('explains network failures when the API does not respond', () => {
  assert.equal(
    getApiErrorMessage({ request: {} }),
    'Unable to connect to the server. Check your connection and try again.'
  )
})