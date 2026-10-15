'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function BillingControls({ connected, billingType }: { connected: boolean; billingType: string | null }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function openPortal() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || 'Billing management is unavailable.')
      window.location.assign(data.url)
    } catch (value) { setError(value instanceof Error ? value.message : 'Billing management is unavailable.'); setBusy(false) }
  }
  return <div>
    {connected ? <><p>{billingType === 'subscription' ? 'Manage your payment method, invoices, or subscription in Stripe. Available cancellation choices are shown in the billing portal.' : 'View invoices and payment details in Stripe. This purchase has no monthly subscription renewal.'}</p><button type="button" className="account-outline-button" disabled={busy} onClick={openPortal}>{busy ? 'Opening billing…' : 'Open billing management'}</button></> : <p>No connected Stripe billing account was found for this membership. If your access was gifted, it does not create a subscription to cancel. Contact support to confirm other billing arrangements.</p>}
    {error ? <p role="alert">{error}</p> : null}
    <p>For billing help or to request cancellation, contact support with your account email and receipt. Do not send your password or payment card details.</p><Link href="/support">Support and cancellation help</Link>
  </div>
}
