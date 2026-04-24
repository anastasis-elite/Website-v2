import type { CSSProperties } from 'react'

export default function MedicalClearancePage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Action Required</p>

        <h1 style={heroTitleStyle}>
          Medical clearance is required before moving forward.
        </h1>

        <p style={heroTextStyle}>
          Based on your responses, we need confirmation that it is safe for you to
          participate in a structured training program.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why this step matters</h2>
          <p style={bodyStyle}>
            This is not a limitation — it’s protection. Ensuring your body is cleared
            allows us to build your plan correctly and responsibly.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What to do next</h2>
          <p style={bodyStyle}>
            Please obtain written clearance from your healthcare provider and return
            to complete your application once you have it available.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/apply" style={primaryButtonStyle}>
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
}

const primaryButtonStyle: CSSProperties = {
  background: '#c58b57',
  color: '#000',
  padding: '14px 24px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}
