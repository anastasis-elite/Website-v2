
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
          <a href="/why-ember" style={secondaryButtonStyle}>
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
