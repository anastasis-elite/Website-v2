import type { CSSProperties } from 'react'

export default function EmberRecommendPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Recommended Path</p>

        <h1 style={heroTitleStyle}>
          You don’t need more information.
          <br />
          You need less thinking.
        </h1>

        <p style={heroTextStyle}>
          Ember was recommended because your answers suggest you already have the
          discipline, awareness, and ability to execute — you just need the structure
          handled for you.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why Ember fits</h2>
          <p style={bodyStyle}>
            You’ve already learned pieces of what works. But carrying the daily weight
            of deciding how much, when, how often, and whether it’s enough creates
            friction.
          </p>

          <p style={bodyStyle}>
            Ember removes that friction. Your structure is calculated. Your numbers are
            set. Your execution becomes cleaner, simpler, and easier to sustain.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What Ember gives you</h2>
          <p style={bodyStyle}>
            Ember is the base layer — a precision execution system for women who are
            self-led and ready to stop wasting energy figuring everything out manually.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/ember/cart" style={primaryButtonStyle}>
            Continue with Ember
          </a>

          <a href="/apply" style={secondaryButtonStyle}>
            Return to Application
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
