export function normalizeStudentProfile(response) {
  const envelope = response?.data ?? response
  const profile = envelope && Object.hasOwn(envelope, 'data')
    ? envelope.data
    : envelope

  if (!profile || typeof profile !== 'object') return null

  return {
    displayName: profile.user?.displayName || profile.displayName || 'Student',
    email: profile.officialEmail || profile.user?.email || profile.notificationEmail || '',
    studentNumber: profile.studentNumber || '',
    officialEmail: profile.officialEmail || '',
    notificationEmail: profile.notificationEmail || '',
  }
}
