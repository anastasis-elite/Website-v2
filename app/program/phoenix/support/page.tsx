export default function PhoenixSupportPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={heroTitleStyle}>
          There are other ways to step into this.
        </h1>

        <p style={heroTextStyle}>
          You don’t have to explain everything to move forward.
        </p>

        <section style={sectionStyle}>
          <p style={bodyStyle}>
            If cost, timing, or external factors are making this feel out of reach,
            there are alternative entry paths available.
          </p>

          <p style={bodyStyle}>
            This is not a barrier. It’s just a different starting point.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/phoenix/support/apply" style={primaryButtonStyle}>
            Continue
          </a>
        </div>
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  background: '#000',
  color: '#f5f0e8',
  minHeight: '100vh',
  padding: '120px 24px',
}

const containerStyle: React.CSSProperties = {
  maxWidth: '980px',
  margin: '0 auto',
}

const heroTitleStyle: React.CSSProperties = {
  fontSize: 'clamp(2.8rem, 5vw, 5rem)',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
  margin: '0 0 28px 0',
  maxWidth: '900px',
}

const heroTextStyle: React.CSSProperties = {
  fontSize: '1.12rem',
  lineHeight: 1.9,
  color: '#d7c7b6',
  maxWidth: '780px',
  marginBottom: '56px',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '72px',
}

const bodyStyle: React.CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.05rem',
  maxWidth: '820px',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
}

const primaryButtonStyle: React.CSSProperties = {
  background: '#c58b57',
  color: '#000',
  padding: '14px 24px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 600,
}
