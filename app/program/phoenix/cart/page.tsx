
export default function PhoenixCartPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Recommended Starting Point</p>

        <h1 style={heroTitleStyle}>
          Phoenix was recommended for you.
        </h1>

        <p style={heroTextStyle}>
          Based on what you shared, a deeper and more immersive level of support
          appears to be the strongest fit for your current needs, complexity, and
          desired level of precision.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What you’re stepping into</h2>
          <p style={bodyStyle}>
            Phoenix is the most adaptive and high-support level of the system. It
            is intended for women who want the deepest alignment, the greatest
            responsiveness, and the strongest level of precision available inside
            the work.
          </p>
        </section>

        <section style={cartBoxStyle}>
          <h2 style={sectionTitleStyle}>Phoenix</h2>
          <p style={bodyStyle}>
            Your recommended starting point.
          </p>

          <a href="#" style={primaryButtonStyle}>
            Continue to Checkout
          </a>
        </section>

        <div style={buttonRowStyle}>
          <a href="/why-phoenix" style={secondaryButtonStyle}>
            Why was Phoenix recommended?
          </a>
          <a href="/ignite" style={secondaryButtonStyle}>
            Need a lighter level? Explore Ignite
          </a>
        </div>
      </div>
    </main>
  )
}
