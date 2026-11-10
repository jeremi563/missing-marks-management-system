const supportedRoles = new Set(['student', 'lecturer', 'cod'])

export function buildRegistrationPayload({ role, displayName, email, password, identityNumber }) {
  if (!supportedRoles.has(role)) {
    throw new TypeError('Choose a supported account type.')
  }

  const normalizedIdentity = identityNumber.trim()

  return {
    role,
    displayName: displayName.trim(),
    email: email.trim(),
    password,
    ...(role === 'student'
      ? { studentNumber: normalizedIdentity }
      : { staffNumber: normalizedIdentity }),
  }
}
