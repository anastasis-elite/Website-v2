export const SITE_URL =
  (process.env.NEXT_PUBLIC_APP_URL || 'https://anastasiselite.com').replace(/\/$/, '')

export const BRAND_NAME = 'Anastasis'
export const BRAND_DESCRIPTOR = 'Health & Performance Concierge Platform for Women'
export const BRAND_TITLE = `${BRAND_NAME} | ${BRAND_DESCRIPTOR}`

export const BRAND_DESCRIPTION =
  'Anastasis brings training plans, nutrition targets, recovery guidance, and recorded progress together for women, with practical guidance informed by goals, circumstances, and check-ins.'

export const BRAND_SUPPORTING_DESCRIPTION =
  'A founder-led health and performance platform for women, designed to make the next useful step clearer through member inputs, check-ins, and recorded progress. Features vary by support level.'

export function absoluteUrl(path = '/') {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export const LOGO_URL = absoluteUrl('/Logo.png')
export const OG_IMAGE_URL = absoluteUrl('/Logo.png')
