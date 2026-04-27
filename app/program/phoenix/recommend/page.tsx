import type { CSSProperties } from 'react'

export default function PhoenixRecommendPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Recommended Path</p>

        <h1 style={heroTitleStyle}>
          You’re not here to guess anymore.
          <br />
          You’re here to get it right.
        </h1>

        <p style={heroTextStyle}>
          Phoenix was recommended because your answers suggest you are ready for a
          deeper, more personalized transformation system — not another generic plan.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why Phoenix fits</h2>
          <p style={bodyStyle}>
            At this level, doing more is not the answer. The margin for error gets
            smaller, and the cost of guessing gets higher. You need precision,
            personalization, and strategic oversight.
          </p>

          <p style={bodyStyle}>
            Phoenix is designed around your goals, physiology, progression, and
            timeline. This is where decisions become deliberate and your system adapts
            with you.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What Phoenix gives you</h2>
          <p style={bodyStyle}>
            Phoenix includes a more personalized program path, deeper structure,
            the science behind the system, and one 1:1 session per quarter throughout
            the year.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/phoenix/cart" style={primaryButtonStyle}>
            Apply for Phoenix
          </a>

           <a href="/program/ignite" style={secondaryButtonStyle}>

    Prefer less structure? Explore Ignite

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
