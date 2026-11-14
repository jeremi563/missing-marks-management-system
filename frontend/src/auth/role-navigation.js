function getRole(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role]
  if (roles.includes('administrator')) return 'admin'
  if (roles.includes('cod')) return 'cod'
  return roles.find(Boolean)
}

const routeRoles = {
  student: 'student',
  lecturer: 'lecturer',
  cod: 'cod',
  admin: 'administrator',
}

export function getPostLoginDestination(user, returnPath) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean)
  const firstPathSegment = returnPath?.pathname?.split('/')[1]
  const requiredRole = routeRoles[firstPathSegment]

  if (returnPath?.pathname && (!requiredRole || roles.includes(requiredRole))) {
    return `${returnPath.pathname}${returnPath.search || ''}${returnPath.hash || ''}`
  }

  return `/${getRole(user) || 'student'}`
}
