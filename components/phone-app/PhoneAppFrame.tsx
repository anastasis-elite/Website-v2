import Link from 'next/link'
import type { ReactNode } from 'react'
import './phone-app.css'

export default function PhoneAppFrame({ title, subtitle, eyebrow, account = false, children }: {
  title: string; subtitle: string; eyebrow: string; account?: boolean; children: ReactNode
}) {
  return <div className={`phone-app-surface${account ? ' phone-app-account' : ''}`}>
    <div className="phone-app-shell">
      <header className="phone-app-header">
        <Link href="/dashboard" className="phone-app-back" aria-label="Return to Today">‹ <span>Today</span></Link>
        <div className="phone-app-brand"><span>Anastasis</span><small>Elite</small></div>
        <p className="phone-app-eyebrow">{eyebrow}</p>
        <h1>{title}</h1><p className="phone-app-subtitle">{subtitle}</p>
      </header>
      {children}
    </div>
  </div>
}

export function PhoneAppCard({ title, copy, illustration = 'recovery', href, action = 'Explore', unavailable }: {
  title: string; copy: string; illustration?: 'nutrition' | 'training' | 'recovery' | 'water' | 'schedule' | 'check-in'; href?: string; action?: string; unavailable?: string
}) {
  return <article className="phone-app-card">
    <img src={`/illustrations/today-${illustration}.svg`} alt="" width="360" height="180" />
    <div><h3>{title}</h3><p>{copy}</p>{href && !unavailable ? <Link href={href}>{action}<span aria-hidden="true">↗</span></Link> : <small className="phone-app-unavailable">{unavailable || 'Currently unavailable'}</small>}</div>
  </article>
}
