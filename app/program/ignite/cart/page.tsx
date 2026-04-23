
export default function IgniteCartPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Recommended Starting Point</p>

        <h1 style={heroTitleStyle}>
          Ignite was recommended for you.
        </h1>

        <p style={heroTextStyle}>
          Based on what you shared, a more guided and responsive level of support
          appears to be the strongest fit for your current goals, friction points,
          and level of needed refinement.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What you’re stepping into</h2>
          <p style={bodyStyle}>
            Ignite is built for women who want more than just a framework. It is
            a stronger fit when your current season calls for support, adjustment,
            and a system that responds more directly to what your body and life
            are asking for.
          </p>
        </section>

        <section style={cartBoxStyle}>
          <h2 style={sectionTitleStyle}>Ignite</h2>
          <p style={bodyStyle}>
            Your recommended starting point.
          </p>

          <a href="#" style={primaryButtonStyle}>
            Continue to Checkout
          </a>
        </section>

        <div style={buttonRowStyle}>
          <a href="/why-ignite" style={secondaryButtonStyle}>
            Why was Ignite recommended?
          </a>
          <a href="/ember" style={secondaryButtonStyle}>
            Need less support? Explore Ember
          </a>
          <a href="/phoenix" style={secondaryButtonStyle}>
            Need deeper support? Explore Phoenix
          </a>
        </div>
      </div>
    </main>
  )
}
