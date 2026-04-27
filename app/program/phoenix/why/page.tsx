export default function PhoenixWhyPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Phoenix • Selection</p>

        <h1 style={heroTitleStyle}>You were chosen for Phoenix.</h1>

        <p style={heroTextStyle}>
          Not because you need to be pushed harder.
          <br />
          Because you deserve to be supported more deeply.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why Phoenix fits you</h2>

          <p style={bodyStyle}>
            Phoenix was built for the woman who knows she wants to change, but does
            not yet feel fully safe, clear, or supported enough to do it alone.
          </p>

          <p style={bodyStyle}>
            You may know what you do not like about where you are right now. You may
            feel tired of being stuck. You may feel like you want more for yourself,
            but you are not fully sure where to begin, what to trust, or how to keep
            choosing yourself when life has taught you not to.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What we saw in your application</h2>

          <div style={bodyStyle}>
            <p>You need more than a plan.</p>
            <p>You need guidance that helps you feel safe enough to begin.</p>
            <p>You need structure that does not shame you for needing support.</p>
            <p>You need a system that helps you rebuild trust with yourself.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Phoenix is not about forcing yourself forward</h2>

          <p style={bodyStyle}>
            This path is not built on punishment, pressure, or pretending you are fine.
          </p>

          <p style={bodyStyle}>
            Phoenix is the most extensive path because it is the most supported one.
            It is designed for the woman who may have spent years surviving,
            shrinking, silencing herself, or trying to become smaller so life felt
            safer.
          </p>

          <p style={bodyStyle}>
            Here, the goal is not just to change your body.
            The goal is to help you hear yourself again.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What Phoenix helps you reclaim</h2>

          <div style={bodyStyle}>
            <p>Your voice.</p>
            <p>Your confidence.</p>
            <p>Your structure.</p>
            <p>Your boundaries.</p>
            <p>Your sense of direction.</p>
            <p>Your ability to trust your own decisions again.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>This is the gentlest path</h2>

          <p style={bodyStyle}>
            Phoenix may look like the highest level of support, but at its core,
            it is the gentlest.
          </p>

          <p style={bodyStyle}>
            Because some women do not need to be challenged first.
            They need to feel held first.
          </p>

          <p style={bodyStyle}>
            They need someone to help them find the next right step without making
            them feel weak for not seeing it yet.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>You are not too far gone</h2>

          <p style={bodyStyle}>
            You were not chosen for Phoenix because you are broken.
          </p>

          <p style={bodyStyle}>
            You were chosen because this path was built for the woman who is ready
            to stop disappearing from her own life.
          </p>

          <p style={bodyStyle}>
            This is where rebuilding becomes supported.
          </p>

          <div style={{ ...bodyStyle, marginTop: '40px' }}>

    <p style={{ marginBottom: '12px' }}>

      I see you.

    </p>

    <p style={{ marginBottom: '12px' }}>

      I have been you.

    </p>

    <p>

      And you do not have to find your way out of this alone.

    </p>

  </div>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/phoenix" style={primaryButtonStyle}>
            Step into Phoenix
          </a>

          <a href="/program" style={secondaryButtonStyle}>
            Return to Programs
          </a>
        </div>
        <section style={sectionStyle}>
  <h2 style={sectionTitleStyle}>If moving forward feels complicated</h2>

  <div style={bodyStyle}>
    <p>If this feels out of reach financially…</p>
    <p>If you feel like you need to justify this decision…</p>
    <p>If something outside of you is making this harder to step into…</p>

    <a href="/program/phoenix/support" style={quietLinkStyle}>
      There are other ways to enter this.
    </a>
  </div>
</section>
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

const quietLinkStyle: React.CSSProperties = {
  color: '#c58b57',
  fontSize: '0.9rem',
  opacity: 0.7,
  textDecoration: 'underline',
  cursor: 'pointer',
  display: 'inline-block',
  marginTop: '8px',
}
