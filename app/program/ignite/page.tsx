
export default function IgnitePage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Ignite</p>

        <h1 style={heroTitleStyle}>
          Guided. Responsive. Refined.
        </h1>

        <p style={heroTextStyle}>
          Ignite is designed for the woman who no longer wants to interpret
          everything alone. It adds a deeper layer of support, adjustment, and
          responsiveness so the system begins to meet her where she is instead
          of expecting her to force herself through it.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Who Ignite is for</h2>
          <p style={bodyStyle}>
            Ignite is for the woman who wants structure but knows she would
            benefit from a more guided experience. She is ready for a system
            that responds to friction instead of ignoring it.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What it offers</h2>
          <div style={cardGridStyle}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Responsive support</h3>
              <p style={cardTextStyle}>
                More guidance and refinement built into the process.
              </p>
            </div>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Better adaptation</h3>
              <p style={cardTextStyle}>
                Designed for women who need more than a self-led framework.
              </p>
            </div>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Greater precision</h3>
              <p style={cardTextStyle}>
                A more supported version of the system with more responsiveness.
              </p>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>The feel of Ignite</h2>
          <p style={bodyStyle}>
            Supported. Seen. Calibrated. Ignite is for the woman who wants the
            system to begin adjusting more directly around her.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/ignite/cart" style={primaryButtonStyle}>
            Continue to Ignite
          </a>
          <a href="/program" style={secondaryButtonStyle}>
            Return to Program
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

const eyebrowStyle: React.CSSProperties = {
  letterSpacing: '6px',
  fontSize: '12px',
  color: '#c58b57',
  opacity: 0.85,
  marginBottom: '24px',
  textTransform: 'uppercase',
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

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.7rem',
  marginBottom: '18px',
  fontWeight: 500,
}

const bodyStyle: React.CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.05rem',
  maxWidth: '820px',
}

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '22px',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(197,139,87,0.18)',
  borderRadius: '24px',
  padding: '28px 24px',
  background: 'rgba(255,255,255,0.01)',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  marginBottom: '12px',
  fontWeight: 500,
}

const cardTextStyle: React.CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1.8,
  color: '#d7c7b6',
  margin: 0,
}

const cartBoxStyle: React.CSSProperties = {
  border: '1px solid rgba(197,139,87,0.22)',
  borderRadius: '28px',
  padding: '32px',
  background: 'rgba(255,255,255,0.01)',
  marginBottom: '48px',
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

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #c58b57',
  color: '#f5f0e8',
  padding: '14px 24px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,
  opacity: 0.85,
}
