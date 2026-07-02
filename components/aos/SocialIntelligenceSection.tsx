import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function SocialIntelligenceSection() {
  let connected = false
  let profile: {
    display_name?: string | null
    followers?: number | string | null
  } | null = null
  let postCount = 0
  let totalViews = 0

  try {
    const admin = createAdminClient()
    const [{ data: account }, { data: latestProfile }, { data: posts }] = await Promise.all([
      admin.from('social_accounts').select('id').eq('provider', 'tiktok').eq('owner', 'internal/anastasis').maybeSingle(),
      admin.from('social_profiles').select('*').eq('platform', 'tiktok').order('synced_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('social_posts').select('views').eq('platform', 'tiktok'),
    ])
    connected = Boolean(account)
    profile = latestProfile
    postCount = posts?.length || 0
    totalViews = posts?.reduce((sum, post) => sum + Number(post.views || 0), 0) || 0
  } catch (error) {
    console.error('Social Intelligence summary unavailable:', error)
  }

  return (
    <section style={styles.cartBoxStyle}>
      <p style={styles.eyebrowStyle}>Social Intelligence</p>
      <h2 style={{ ...styles.h2Style, marginTop: 0 }}>
        {connected ? (profile?.display_name || 'TikTok connected') : 'TikTok is not connected'}
      </h2>
      <div style={styles.cardGridStyle}>
        <div style={styles.cardStyle}>
          <h3 style={styles.cardTitleStyle}>{Number(profile?.followers || 0).toLocaleString()}</h3>
          <p style={styles.cardTextStyle}>Followers</p>
        </div>
        <div style={styles.cardStyle}>
          <h3 style={styles.cardTitleStyle}>{postCount.toLocaleString()}</h3>
          <p style={styles.cardTextStyle}>Videos synced</p>
        </div>
        <div style={styles.cardStyle}>
          <h3 style={styles.cardTitleStyle}>{totalViews.toLocaleString()}</h3>
          <p style={styles.cardTextStyle}>Current video views</p>
        </div>
      </div>
      <div style={{ ...styles.buttonRowStyle, marginTop: '24px' }}>
        <Link href="/admin/social/connect-tiktok" style={styles.primaryButtonStyle}>
          {connected ? 'Manage TikTok' : 'Connect TikTok'}
        </Link>
        <Link href="/aos/social" style={styles.secondaryButtonStyle}>Open Social Intelligence</Link>
      </div>
    </section>
  )
}
