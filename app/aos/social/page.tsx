import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { sampleSocialPosts } from '@/lib/aos/social/sampleData'
import { getSocialIntelligenceSnapshot } from '@/lib/aos/social/getSocialSnapshot'
import { ContentSignal } from '@/lib/aos/social/types'

export default function AOSSocialPage() {
  const snapshot = getSocialIntelligenceSnapshot(sampleSocialPosts)

  return (
    <main style={styles.pageStyle}>
      <p style={styles.eyebrowStyle}>Anastasis Operating System</p>

      <h1 style={styles.heroTitleStyle}>Social Intelligence</h1>

      <p style={styles.heroTextStyle}>
        A centralized view of visibility, resonance, audience alignment, and
        next-best content moves across Anastasis social platforms.
      </p>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Current Snapshot</p>

        <h2 style={styles.h2Style}>
          {snapshot.totalViews.toLocaleString()} total views analyzed
        </h2>

        <p style={styles.bodyStyle}>
          {snapshot.totalEngagement.toLocaleString()} engagement signals detected
          across the current sample dataset.
        </p>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Strongest Post</p>

        {snapshot.strongestPost ? (
          <>
            <h2 style={styles.h2Style}>
              {snapshot.strongestPost.hook ?? 'Untitled post'}
            </h2>

            <p style={styles.bodyStyle}>
              Platform: {snapshot.strongestPost.platform}
              <br />
              Pillar: {snapshot.strongestPost.pillar}
              <br />
              Format: {snapshot.strongestPost.format.replace('_', ' ')}
              <br />
              Views: {snapshot.strongestPost.views.toLocaleString()}
              <br />
              Likes: {snapshot.strongestPost.likes.toLocaleString()}
              <br />
              Comments: {snapshot.strongestPost.comments.toLocaleString()}
              <br />
              Shares: {snapshot.strongestPost.shares.toLocaleString()}
            </p>

            {snapshot.strongestPost.caption && (
              <p style={styles.bodyStyle}>{snapshot.strongestPost.caption}</p>
            )}
          </>
        ) : (
          <p style={styles.bodyStyle}>No social posts detected yet.</p>
        )}
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Strongest Signals</p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {snapshot.strongestSignals.map((signal: ContentSignal) => (
            <div
              key={`${signal.postId}-${signal.signalType}`}
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '16px',
                padding: '1rem',
              }}
            >
              <h3 style={styles.h2Style}>
                {signal.signalType.replace('_', ' ')} — {signal.score}/100
              </h3>

              <p style={styles.bodyStyle}>{signal.reason}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Next Content Moves</p>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {snapshot.nextContentMoves.map((move: string) => (
            <p key={move} style={styles.bodyStyle}>
              → {move}
            </p>
          ))}
        </div>
      </section>

      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>Raw Posts</p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {sampleSocialPosts.map((post) => (
            <div
              key={post.id}
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '16px',
                padding: '1rem',
              }}
            >
              <h3 style={styles.h2Style}>{post.hook ?? post.id}</h3>

              <p style={styles.bodyStyle}>
                {post.platform} · {post.pillar ?? 'uncategorized'} · {(post.format ?? 'unknown').replace('_', ' ')}
              </p>

              <p style={styles.bodyStyle}>
                Views: {post.views.toLocaleString()} · Likes:{' '}
                {post.likes.toLocaleString()} · Comments:{' '}
                {post.comments.toLocaleString()} · Shares:{' '}
                {post.shares.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/aos" style={styles.linkStyle}>
        ← Back to AOS
      </Link>
    </main>
  )
}
