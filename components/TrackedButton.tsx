'use client'

import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { trackEvent } from '@/lib/analytics'

export default function TrackedButton({
  href,
  children,
  event,
  properties = {},
  variant = 'primary',
}: {
  href: string
  children: React.ReactNode
  event: string
  properties?: Record<string, string | number | boolean | null>
  variant?: 'primary' | 'secondary'
}) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '220px',
    textAlign: 'center' as const,
  }

  return (
    <Link
      href={href}
      onClick={() => trackEvent(event, properties)}
      style={{
        ...baseStyle,
        ...(variant === 'primary'
          ? styles.primaryButtonStyle
          : styles.secondaryButtonStyle),
      }}
    >
      {children}
    </Link>
  )
}
