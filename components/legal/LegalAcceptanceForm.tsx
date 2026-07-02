'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'
import AIDisclaimer from '@/components/legal/AIDisclaimer'

const required = [
  ['terms', 'I accept the Terms of Service.', '/terms'],
  ['privacy', 'I acknowledge the Privacy Policy.', '/privacy'],
  ['healthDisclaimer', 'I acknowledge the Health and Safety Disclaimer.', '/health-disclaimer'],
  ['aiDisclaimer', 'I acknowledge the AI-Assisted Recommendations Disclaimer.', '/ai-disclaimer'],
] as const

export default function LegalAcceptanceForm() {
  const router = useRouter()
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [researchConsent, setResearchConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const ready = required.every(([key]) => checks[key])

  async function submit() {
    if (!ready) return
    setLoading(true)
    setMessage('')
    const response = await fetch('/api/legal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...checks,
        researchConsent,
        source: 'dashboard_legal_gate',
        featureConsents: {
          ai_recommendations: true,
          anonymized_research_use: researchConsent,
        },
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setMessage(data.error || 'Acceptance could not be recorded.')
      setLoading(false)
      return
    }
    router.replace(data.redirect || '/dashboard')
    router.refresh()
  }

  return <div style={{ display: 'grid', gap: '22px' }}>
    <AIDisclaimer />
    <section style={styles.cartBoxStyle}>
      <p style={styles.eyebrowStyle}>Required</p>
      {required.map(([key, label, href]) => <label key={key} style={checkStyle}>
        <input type="checkbox" checked={Boolean(checks[key])} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} />
        <span>{label} <Link href={href} target="_blank" style={styles.quietLinkStyle}>Read</Link></span>
      </label>)}
    </section>
    <section style={styles.cartBoxStyle}>
      <p style={styles.eyebrowStyle}>Optional Research</p>
      <label style={checkStyle}>
        <input type="checkbox" checked={researchConsent} onChange={(event) => setResearchConsent(event.target.checked)} />
        <span>I voluntarily consent to anonymized research use under the <Link href="/research-consent" target="_blank" style={styles.quietLinkStyle}>Research Consent</Link>. This is not required for access.</span>
      </label>
    </section>
    <button type="button" disabled={!ready || loading} onClick={submit} style={{ ...styles.primaryButtonStyle, opacity: ready && !loading ? 1 : .5 }}>{loading ? 'Recording…' : 'Accept and Continue'}</button>
    {message ? <p style={styles.bodyStyle}>{message}</p> : null}
  </div>
}

const checkStyle = { display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#f5f0e8', lineHeight: 1.6, margin: '16px 0' } as const
