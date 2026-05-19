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
  return (
    <Link
      href={href}
      style={
        variant === 'primary'
          ? styles.primaryButtonStyle
          : styles.secondaryButtonStyle
      }
    >
      {children}
    </Link>
  )
}
