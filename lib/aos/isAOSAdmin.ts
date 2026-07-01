export function isAOSAdmin(email?: string | null) {
  if (!email) return false
  const configured = process.env.AOS_ADMIN_EMAILS
    ?.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const allowed = configured?.length ? configured : ['anastasis.elite@gmail.com']
  return allowed.includes(email.toLowerCase())
}
