import type { CSSProperties } from 'react'

export default function IgniteRecommendPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Recommended Path</p>

        <h1 style={heroTitleStyle}>
          You didn’t fail.
          <br />
          Your system did.
        </h1>

        <p style={heroTextStyle}>
          Ignite was recommended because your answers suggest you’ve been trying,
          showing up, and pushing — but the structure you’ve been using may not be
          evolving with you.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why Ignite fits</h2>
          <p style={bodyStyle}>
            At some point, consistency stops being enough if the system underneath it
            is not aligned. Your body adapts. Your recovery matters. Your environment
            matters. The structure has to change with you.
          </p>

          <p style={bodyStyle}>
            Ignite gives you more than a plan. It gives you the correction, context,
            and guidance to understand why the structure works and how to align your
            daily life around it.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What Ignite gives you</h2>
          <p style={bodyStyle}>
            Ignite is for women who need more support than self-led execution. You’ll
            receive the structure, plus digestible guidance that helps you stop
            guessing and start building progress that holds.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/ignite/cart" style={primaryButtonStyle}>
            Continue with Ignite
          </a>

          <a href="/program/ember" style={secondaryButtonStyle}>

    Prefer less structure? Explore Ember

  </a>

  <a href="/program/phoenix" style={secondaryButtonStyle}>

    Want deeper support? Explore Phoenix

  </a>
        </div>
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  background: '#000',
  color: '#f5f0e8',
  minHeight: '100vh',
  padding: '120px 24px',
}

const containerStyle: CSSProperties = {
  maxWidth: '980px',
  margin: '0 auto',
}

const eyebrowStyle: CSSProperties = {
  letterSpacing: '6px',
  fontSize: '12px',
  color: '#c58b57',
  opacity: 0.85,
  marginBottom: '24px',
  textTransform: 'uppercase',
}

const heroTitleStyle: CSSProperties = {
  fontSize: 'clamp(2.8rem, 5vw, 5rem)',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
  marginBottom: '28px',
}

const heroTextStyle: CSSProperties = {
  fontSize: '1.12rem',
  lineHeight: 1.9,
  color: '#d7c7b6',
  maxWidth: '780px',
  marginBottom: '64px',
}

const sectionStyle: CSSProperties = {
  marginBottom: '56px',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.7rem',
  marginBottom: '18px',
  fontWeight: 500,
}

const bodyStyle: CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.06rem',
  maxWidth: '820px',
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
}

const primaryButtonStyle: CSSProperties = {
  background: '#c58b57',
  color: '#000',
  padding: '14px 24px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #c58b57',
  color: '#f5f0e8',
  padding: '14px 24px',
  borderRadius: '999px',
  textDecoration: 'none',
  opacity: 0.85,
}
