import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

export default function Button({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: React.ReactNode
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
