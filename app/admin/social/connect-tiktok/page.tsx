import Link from 'next/link'
import { redirect } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'
import TikTokSyncControls from '@/components/aos/TikTokSyncControls'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'
import { getTikTokAccount } from '@/lib/aos/social/tiktok/api'

export const dynamic = 'force-dynamic'

export default async function ConnectTikTokPage({
  searchParams,
}: {
  searchParams?: Promise<{ connected?: string; error?: string }>
}) {
  const query = await searchParams
  if (!(await getAOSAdminUser())) redirect('/aos-login')

  let account = null
  let databaseReady = true
  try {
    account = await getTikTokAccount()
  } catch (error) {
    databaseReady = false
    console.error('Could not load TikTok account:', error)
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Internal integration</p>
        <h1 style={styles.heroTitleStyle}>Lyndsey&apos;s TikTok</h1>
        <p style={styles.heroTextStyle}>
          Connect the Anastasis TikTok account to AOS. OAuth tokens remain encrypted and server-only.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={{ ...styles.h2Style, marginTop: 0 }}>
            {account ? 'TikTok connected' : 'Connect TikTok'}
          </h2>
          <p style={styles.bodyStyle}>
            {account
              ? `Status: connected${account.access_token_expires_at ? ` · access refreshes automatically` : ''}`
              : 'Authorize profile, account statistics, and public video access for the internal Social Intelligence system.'}
          </p>

          {query?.connected === 'true' && <p style={styles.bodyStyle}>Connection saved.</p>}
          {query?.error && <p style={{ ...styles.bodyStyle, color: '#e9a98f' }}>Connection failed: {query.error.replaceAll('_', ' ')}</p>}
          {!databaseReady && <p style={{ ...styles.bodyStyle, color: '#e9a98f' }}>Apply the social intelligence Supabase migration before connecting.</p>}

          <div style={{ ...styles.buttonRowStyle, marginTop: '24px' }}>
            <a href="/api/internal/tiktok/auth" style={styles.primaryButtonStyle}>
              {account ? 'Reconnect Lyndsey’s TikTok' : 'Connect Lyndsey’s TikTok'}
            </a>
          </div>
          <div style={{ marginTop: '18px' }}>
            <TikTokSyncControls connected={Boolean(account)} />
          </div>
        </section>

        <Link href="/aos" style={styles.quietLinkStyle}>← Back to Command Center</Link>
      </div>
    </main>
  )
}
