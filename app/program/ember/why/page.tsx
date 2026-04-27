export default function EmberWhyPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Ember • Selection</p>

        <h1 style={heroTitleStyle}>
          You were chosen for Ember.
        </h1>

        <p style={heroTextStyle}>
          Based on what you shared, you are not lacking discipline.
          You are not lacking effort.
          You are not lacking awareness.

          You are operating at a level where the issue is no longer
          whether you show up.

          It’s whether the structure you’re following is actually
          built for you.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why Ember fits you</h2>

          <p style={bodyStyle}>
            You were placed into Ember because you demonstrated the ability
            to self-regulate, self-direct, and execute without needing
            constant intervention.

            You already carry structure in your life.

            What you’ve been missing is not discipline.
            It’s alignment.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What we saw in your application</h2>

          <div style={bodyStyle}>
            <p>You know how to follow through.</p>
            <p>You are capable of consistency.</p>
            <p>You have direction, even if it feels unclear at times.</p>
            <p>You do not need to be managed.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Where things have been breaking down</h2>

          <div style={bodyStyle}>
            <p>The systems you’ve followed were not built for your physiology.</p>
            <p>You’ve had to think through too many decisions on your own.</p>
            <p>Your structure hasn’t matched how your body actually responds.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What Ember is meant to do for you</h2>

          <p style={bodyStyle}>
            Ember removes the need to constantly analyze and adjust everything
            yourself.

            It gives you calculated structure so your effort finally translates
            into results.

            Not by doing more.

            But by doing what actually fits.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Important to understand</h2>

          <p style={bodyStyle}>
            Ember is not designed to keep you dependent.

            It is designed to refine your process to the point where you no longer
            need external guidance.

            This is not a long-term hold.

            It is a precision phase.

            A year of alignment that allows you to move forward with clarity,
            confidence, and a system that finally works.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/ember" style={primaryButtonStyle}>
            Step into Ember
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
