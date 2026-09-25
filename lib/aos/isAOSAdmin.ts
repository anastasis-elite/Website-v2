const trustedAdminRoles = new Set(['admin', 'owner', 'staff'])

export function isAOSAdmin(
  email?: string | null,
  appMetadata?: Record<string, unknown> | null,
) {
  const role = String(appMetadata?.role || '').toLowerCase()
  const roles = Array.isArray(appMetadata?.roles)
    ? appMetadata.roles.map((value) => String(value).toLowerCase())
    : []

  if (role && trustedAdminRoles.has(role)) return true
  if (roles.some((value) => trustedAdminRoles.has(value))) return true
  if (!email) return false

  const configured = process.env.AOS_ADMIN_EMAILS
    ?.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const allowed = configured?.length ? configured : ['anastasis.elite@gmail.com']
  return allowed.includes(email.toLowerCase())
}
