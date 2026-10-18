import Link from 'next/link'
import * as styles from '../styles/globalstyles'
import Image from 'next/image'
import TrackEvent from '@/components/TrackEvent'

export default function GuidePage() {
  return (
    <><TrackEvent event="guide_page_viewed" properties={{ page: 'guide' }} />
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>The Anastasis Shift</p>

        <h1 style={styles.heroTitleStyle}>
          Make a little room for yourself.
        </h1>

        <p style={styles.heroTextStyle}>
          A forthcoming reflection guide about noticing what works for you,
          making space in a full life, and choosing manageable next steps.
        </p>

        <div
          style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '72px',
          }}
        >
        <div
  style={{
    position: 'relative',
    width: '100%',
    maxWidth: '420px',
    margin: '0 auto 42px auto',
  }}
>
  <img
    src="/AA8E8B4D-7C51-42CC-9C18-6B53F085A673.png"
    alt="The Anastasis Shift"
    style={{
      width: '100%',
      borderRadius: '28px',
      display: 'block',
      boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    }}
  />

  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) rotate(-12deg)',
      background: 'rgba(181,110,67,0.88)',
      color: '#f5f0e8',
      padding: '14px 42px',
      borderRadius: '999px',
      fontSize: '1rem',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      fontWeight: 600,
      boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
      backdropFilter: 'blur(10px)',
      whiteSpace: 'nowrap',
    }}
  >
    Coming Soon
  </div>
</div>
        </div>
        
        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Begin with what fits your life.
          </h2>

          <p style={styles.bodyStyle}>
            You already make decisions for a full day. The Anastasis Shift is
            being developed as a place to pause, consider your own priorities,
            and think about the routines you want to make room for.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            The planned guide explores:
          </h2>

          <div style={styles.compactCardGridStyle}>
            {[
              'Your priorities',
              'Noticing your patterns',
              'Daily structure',
              'Making room for yourself',
              'Manageable routines',
              'Choosing what comes next',
            ].map((item) => (
              <div key={item} style={styles.compactCardStyle}>
                <h3 style={styles.compactCardTitleStyle}>{item}</h3>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            Written with a full life in mind.
          </h2>

          <p style={styles.bodyStyle}>
            You may be balancing work, relationships, family, or a changing
            schedule. The guide is intended for women who want time to reflect
            on what is practical and meaningful for them.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>
            The guide is in development.
          </h2>

          <p style={styles.bodyStyle}>
            The Anastasis Shift is not available yet. You can explore the
            current programs while the guide is being prepared, and decide
            whether one fits what you want now.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <a
  href="https://checkout.anastasiselite.com/b/fZu3cu7rdgQvc5T8D74ko02"
  target="_blank"
  rel="noopener noreferrer"
  style={styles.primaryButtonStyle}
>
  Open external checkout
</a>

          <Link href="/apply" style={styles.secondaryButtonStyle}>
            Return to Application
          </Link>
        </div>
      </div>
    </main>
    </>
    )
}
