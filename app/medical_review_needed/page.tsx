import type { CSSProperties } from 'react'

export default function MedicalReviewNeededPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Manual Review Required</p>

        <h1 style={heroTitleStyle}>Your application needs a quick safety review.</h1>

        <p style={bodyStyle}>
          Because you shared an injury, medical condition, or restriction, your application
          will be reviewed before a program recommendation is finalized.
        </p>

        <p style={bodyStyle}>
          If you uploaded medical clearance, it will be reviewed to confirm that it clearly
          supports participation in a structured fitness and nutrition program.
        </p>

        <p style={bodyStyle}>
          This protects both your progress and your safety. Once reviewed, you’ll receive the
          next appropriate step.
        </p>

        <a href="/program" style={primaryButtonStyle}>
          Review Programs
        </a>
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
  maxWidth: '900px',
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

const bodyStyle: CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.08rem',
  maxWidth: '760px',
  marginBottom: '28px',
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: '24px',
  background: '#c58b57',
  color: '#000',
  padding: '14px 24px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}
