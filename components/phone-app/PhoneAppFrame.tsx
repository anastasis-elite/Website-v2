import Link from 'next/link'
import ActionArrow from '@/components/ActionArrow'
import type { ReactNode } from 'react'
import './phone-app.css'

type PhoneAppFrameProps = {
  account?: boolean; backHref?: string; backLabel?: string; children: ReactNode
} & (
  | { compactHeader: true; title?: never; subtitle?: never; eyebrow?: never }
  | { compactHeader?: false; title: string; subtitle?: string; eyebrow: string }
)

export default function PhoneAppFrame({ title, subtitle, eyebrow, compactHeader = false, account = false, backHref = "/dashboard", backLabel = "Today", children }: PhoneAppFrameProps) {
  const Brand = compactHeader ? 'h1' : 'div'
  return <div className={`phone-app-surface${account ? ' phone-app-account' : ''}`}>
    <div className="phone-app-shell">
      <header className={`phone-app-header${compactHeader ? ' phone-app-header--compact' : !subtitle ? ' phone-app-header--title-only' : ''}`}>
        {!compactHeader && <Link href={backHref} className="phone-app-back" aria-label={`Return to ${backLabel}`}>‹ <span>{backLabel}</span></Link>}
        <Brand className="phone-app-brand"><span>Anastasis</span><small>Elite</small></Brand>
        {!compactHeader && <>
          <p className="phone-app-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>{subtitle ? <p className="phone-app-subtitle">{subtitle}</p> : null}
        </>}
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
    <div><h3>{title}</h3><p>{copy}</p>{href && !unavailable ? <Link href={href}>{action}<ActionArrow className="phone-app-action-arrow" /></Link> : <small className="phone-app-unavailable">{unavailable || 'Currently unavailable'}</small>}</div>
  </article>
}
