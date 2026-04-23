
export default function EmberCartPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Recommended Starting Point</p>

        <h1 style={heroTitleStyle}>
          Ember was recommended for you.
        </h1>

        <p style={heroTextStyle}>
          Based on what you shared, a more self-led and structured entry point
          appears to be the strongest fit for your current needs. Ember gives you
          the framework, direction, and clarity to move forward without excess
          complexity.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What you’re stepping into</h2>
          <p style={bodyStyle}>
            Ember is designed to give you a clear system, intelligent structure,
            and a more aligned approach to progress. It is ideal for women who
            want precision and direction while still executing independently.
          </p>
        </section>

        <section style={cartBoxStyle}>
          <h2 style={sectionTitleStyle}>Ember</h2>
          <p style={bodyStyle}>
            Your recommended starting point.
          </p>

          <a href="#" style={primaryButtonStyle}>
            Continue to Checkout
          </a>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/ember/why" style={secondaryButtonStyle}>
            Why was Ember recommended?
          </a>
          <a href="/ignite" style={secondaryButtonStyle}>
            Need more support? Explore Ignite
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
