
export default function EmberPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Ember</p>

        <h1 style={heroTitleStyle}>
          Structured. Precise. Self-led.
        </h1>

        <p style={heroTextStyle}>
          Ember is designed for the woman who wants a clear, intelligent structure
          without needing constant intervention. It gives you the framework,
          removes guesswork, and creates a more aligned path forward without
          taking your autonomy away.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Who Ember is for</h2>
          <p style={bodyStyle}>
            Ember is for the woman who is capable of moving independently but
            knows that the systems she has followed before were not built with
            her physiology in mind. She does not need more chaos, more pressure,
            or more punishment. She needs a structure that finally fits.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What it offers</h2>
          <div style={cardGridStyle}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Clear structure</h3>
              <p style={cardTextStyle}>
                A defined path that removes guesswork and gives you a system to follow.
              </p>
            </div>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Self-led execution</h3>
              <p style={cardTextStyle}>
                Ideal for women who want guidance without high-touch oversight.
              </p>
            </div>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>A better foundation</h3>
              <p style={cardTextStyle}>
                A starting point built around alignment instead of force.
              </p>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>The feel of Ember</h2>
          <p style={bodyStyle}>
            Controlled. Grounded. Clarifying. Ember is not less valuable because
            it is more self-led. It is simply designed for a woman who needs the
            system to finally make sense.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/ember/cart" style={primaryButtonStyle}>
            Continue to Ember
          </a>
          <a href="/program" style={secondaryButtonStyle}>
            Return to Program
          </a>
        </div>
      </div>
    </main>
  )
}
