
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
