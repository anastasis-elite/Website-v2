'use client'

import Link from 'next/link'
import type { AccountData, AccountProfileFormData } from '@/lib/dashboard/account/types'
import AccountProfileForm from '@/components/AccountProfileForm'
import LogoutButton from './LogoutButton'
import BillingControls from './BillingControls'
import { useAccountData, useClientProfile,  } from './hooks'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}


export default function AccountDashboard({ initialData, client, user }: { initialData: AccountData; client: AccountProfileFormData; user: { email: string | null } }) {
  const data = useAccountData(initialData)
  const profile = useClientProfile(data)
  const avatarStyle = profile.avatarUrl ? { backgroundImage: `linear-gradient(rgba(8,5,3,.08),rgba(8,5,3,.2)),url("${profile.avatarUrl}")` } : undefined

  return (
    <PhoneAppFrame account eyebrow="Your account" title="Account details" subtitle="The practical things, all in one place."><main className="account-dashboard">
      <div className="account-shell">
        <p className="phone-app-community-note">These details are separate from the Community preview.</p>

        <section className="account-hero-grid">
          <article className="account-profile-hero">
            <div className="account-avatar" style={avatarStyle} role="img" aria-label={`${profile.name} profile photo`}><span>{profile.avatarUrl ? '' : initials(profile.name)}</span></div>
            <div className="account-profile-copy"><h2>{profile.name}</h2><p className="account-program-label">{profile.program} program</p><a href="#personal-info" className="account-outline-button">Edit Profile</a></div>
          </article>
        </section>
        <nav className="account-panel account-quick-panel" aria-label="Account preferences"><Link href="/dashboard/progress" className="account-outline-button">Progress and assessments</Link><Link href="/dashboard/assessment/daily-structure" className="account-outline-button">Daily Structure preferences</Link><Link href="/dashboard/settings/calendars" className="account-outline-button">Connected calendars</Link></nav>

        <section className="account-lower-grid">
          <article className="account-panel account-settings" id="account-settings"><h2>Account</h2><a href="#personal-info" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">♙</span><span><strong>Personal Info</strong><small>Review your personal details and preferences</small></span><span aria-hidden="true">›</span></a><a href="#security" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">▣</span><span><strong>Security</strong><small>Password and login settings</small></span><span aria-hidden="true">›</span></a><a href="#notifications" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">♢</span><span><strong>Notifications</strong><small>Review notification availability</small></span><span aria-hidden="true">›</span></a><a href="#billing" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">▤</span><span><strong>Billing & Subscriptions</strong><small>{profile.subscriptionStatus ? `Status: ${profile.subscriptionStatus}` : 'Plan and payment support'}</small></span><span aria-hidden="true">›</span></a><a href="/support" className="account-setting-row"><span className="account-setting-icon" aria-hidden="true">?</span><span><strong>Help & Support</strong><small>Get help or contact support</small></span><span aria-hidden="true">›</span></a><LogoutButton /></article>

        </section>

        <section className="account-manage-grid" aria-label="Manage account details">
          <details className="account-panel account-detail-panel" id="personal-info"><summary>Personal Info <span>Open ›</span></summary><AccountProfileForm client={client} user={user} mode="profile" /><div className="account-detail-copy"><Link href="/dashboard/assessment/daily-structure" className="account-outline-button">Update Daily Structure</Link></div></details>
          <details className="account-panel account-detail-panel" id="security"><summary>Security <span>Open ›</span></summary><AccountProfileForm client={client} user={user} mode="security" /></details>
          <details className="account-panel account-detail-panel" id="notifications"><summary>Notifications <span>Open ›</span></summary><div className="account-detail-copy"><p>Your account email is <strong>{profile.email}</strong>.</p><p>Alerts and reminders are not available from this page.</p></div></details>
          <details className="account-panel account-detail-panel" id="billing"><summary>Billing & Subscriptions <span>Open ›</span></summary><div className="account-detail-copy"><p>Current status: <strong>{profile.subscriptionStatus || 'Contact support to confirm'}</strong></p><BillingControls connected={data.billing.connected} billingType={data.billing.billingType} /><div className="account-inline-actions"><Link href="/refund-policy">Billing policy</Link><Link href="/support">Contact billing support</Link></div></div></details>
        </section>
        <section className="account-panel"><h2>Connections &amp; privacy</h2><p>Devices &amp; health apps: connection management is unavailable here.</p><p>Community visibility, profile sharing, data export and deletion requests are not managed on this screen.</p><Link href="/dashboard/settings/calendars" className="account-outline-button">Manage existing calendars</Link><Link href="/support" className="account-outline-button">Privacy and data support</Link></section>

      </div>
    </main></PhoneAppFrame>
  )
}
