'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'

type TrackedLinkProps = {
  href: string
  event: string
  properties?: Record<string, string | number | boolean | null>
  children: React.ReactNode
  style?: React.CSSProperties
}

export default function TrackedLink({
  href,
  event,
  properties = {},
  children,
  style,
}: TrackedLinkProps) {
  return (
    <Link
      href={href}
      style={style}
      onClick={() => {
        trackEvent(event, properties)
      }}
    >
      {children}
    </Link>
  )
}
