import { useEffect, useState } from 'react'

function timestamp(value) {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function verificationWindow(session, now) {
  if (!session) return { open: false, nextChangeAt: null }

  const status = String(session.status || '').toLowerCase()
  const startsAt = timestamp(session.startsAt)
  const endedAt = timestamp(status === 'completed' ? session.updatedAt : session.endsAt)
  const graceMinutes = Number(session.lateGraceMinutes)
  const graceMs = Number.isInteger(graceMinutes) && graceMinutes > 0 ? graceMinutes * 60_000 : 0
  const cutoff = endedAt === null ? null : endedAt + graceMs
  const hasStarted = startsAt === null || now >= startsAt

  const open = status === 'active'
    ? hasStarted && (cutoff === null || now < cutoff)
    : status === 'completed'
      && endedAt !== null
      && now >= endedAt
      && now < cutoff

  const futureChanges = [startsAt, endedAt, cutoff].filter((value) => value !== null && value > now)
  return { open, nextChangeAt: futureChanges.length ? Math.min(...futureChanges) : null }
}

export function useExamBookletVerificationWindow(session) {
  const [now, setNow] = useState(Date.now)
  const { open, nextChangeAt } = verificationWindow(session, now)

  useEffect(() => {
    if (nextChangeAt === null) return undefined
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextChangeAt - Date.now()) + 1)
    return () => clearTimeout(timer)
  }, [nextChangeAt])

  return open
}
