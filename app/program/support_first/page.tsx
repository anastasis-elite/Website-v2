import type { CSSProperties } from 'react'

export default function SupportFirstPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Next Step</p>

        <h1 style={heroTitleStyle}>
          Let’s build your foundation first.
        </h1>

        <p style={heroTextStyle}>
          Based on your responses, the most aligned next step is to prioritize
          stability, support, and safety before moving into a structured program.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why this matters</h2>
          <p style={bodyStyle}>
            Your body is not something to push through — it’s something to work
            with. Creating the right environment now allows you to progress faster,
            safer, and more sustainably long-term.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What happens next</h2>
          <p style={bodyStyle}>
            We’ll take a more supportive approach first, ensuring that your body is
            ready for higher demand training and structured progression.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/apply" style={secondaryButtonStyle}>
            Revisit Application
          </a>

          <a href="/program" style={primaryButtonStyle}>
            Explore Programs
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
  marginBottom: '56px',
}

const sectionStyle: CSSProperties = {
  marginBottom: '56px',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.7rem',
  marginBottom: '18px',
}

const bodyStyle: CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
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
