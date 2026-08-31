export const SITE_URL =
  (process.env.NEXT_PUBLIC_APP_URL || 'https://anastasiselite.com').replace(/\/$/, '')

export const BRAND_NAME = 'Anastasis'
export const BRAND_DESCRIPTOR = 'Health & Performance Concierge Platform for Women'
export const BRAND_TITLE = `${BRAND_NAME} | ${BRAND_DESCRIPTOR}`

export const BRAND_DESCRIPTION =
  'Anastasis is a health and performance concierge platform for women that brings personalized fitness, nutrition, recovery, progress tracking, and daily support into one adaptive system.'

export const BRAND_SUPPORTING_DESCRIPTION =
  'Anastasis integrates fitness, nutrition, recovery, assessments, progress tracking, and daily support into one personalized system designed to adapt to the whole woman and the realities of her life.'

export function absoluteUrl(path = '/') {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export const LOGO_URL = absoluteUrl('/Logo.png')
export const OG_IMAGE_URL = absoluteUrl('/Logo.png')
