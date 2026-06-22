import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

const navItems = [
  { label: 'Command Center', href: '/aos' },
  { label: 'Audits', href: '/aos/audits' },
  { label: 'Clients', href: '/aos/clients' },
  { label: 'Tasks', href: '/aos/tasks' },
  { label: 'Reports', href: '/aos/reports' },
  { label: 'Bots', href: '/aos/bots' },
  { label: 'Content', href: '/aos/content' },
  { label: 'Programs', href: '/aos/programs' },
  { label: 'Settings', href: '/aos/settings' },
]

export default function AOSNavigation() {
  return (
    <nav
      style={{
        marginBottom: '42px',
        padding: '18px',
        borderRadius: '28px',
        background: 'rgba(18,18,18,0.52)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 18px 60px rgba(0,0,0,0.16)',
      }}
    >
      <p
        style={{
          ...styles.eyebrowStyle,
          marginBottom: '16px',
        }}
      >
        AOS Navigation
      </p>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              ...styles.secondaryButtonStyle,
              fontSize: '0.92rem',
              padding: '11px 16px',
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
