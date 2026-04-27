export default function IgniteWhyPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Ignite • Selection</p>

        <h1 style={heroTitleStyle}>You were chosen for Ignite.</h1>

        <p style={heroTextStyle}>
          You were chosen for Ignite because you already know structure matters.
          You have started building systems around your life, your body, your goals,
          and your future — but your current structure still has gaps.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why Ignite fits you</h2>

          <p style={bodyStyle}>
            Ignite was built for the woman who is motivated, aware, and ready —
            but not fully focused yet because too many pieces are still floating.
          </p>

          <p style={bodyStyle}>
            You know where you want to end up. You know something needs to change.
            You have started curating the structure. But knowing you need systems
            and knowing exactly how to build them are two different things.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What we saw in your application</h2>

          <div style={bodyStyle}>
            <p>You have direction, but need clearer execution.</p>
            <p>You are motivated, but not fully locked into the system yet.</p>
            <p>You know the end goal, but need more support with the path.</p>
            <p>You need more guidance than Ember, without needing the full depth of Phoenix.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What Ignite helps clarify</h2>

          <div style={bodyStyle}>
            <p>What to do.</p>
            <p>Why it matters.</p>
            <p>How to execute it.</p>
            <p>When to adjust.</p>
            <p>What to stop overthinking.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why this level matters</h2>

          <p style={bodyStyle}>
            Ember gives structure to women who already know how to self-direct.
            Phoenix builds a highly personalized system around women who need
            deeper precision.
          </p>

          <p style={bodyStyle}>
            Ignite sits between them. It gives you the structure, explanation,
            and guided alignment to help you stop half-building systems and start
            executing one that actually holds.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>You are not behind</h2>

          <p style={bodyStyle}>
            You were not chosen for Ignite because you are behind. You were chosen
            because you are close.
          </p>

          <p style={bodyStyle}>
            Close enough to know what you want. Close enough to feel what is missing.
            Close enough to stop guessing and finally build the system that gets you there.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/ignite" style={primaryButtonStyle}>
            Step into Ignite
          </a>

          <a href="/program" style={secondaryButtonStyle}>
            Return to Programs
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
