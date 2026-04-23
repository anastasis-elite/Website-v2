
export default function PhoenixPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Phoenix</p>

        <h1 style={heroTitleStyle}>
          Immersive. Adaptive. Built around you.
        </h1>

        <p style={heroTextStyle}>
          Phoenix is designed for the woman who wants the highest level of
          precision, support, and adaptation. This is not simply more. It is
          deeper calibration, stronger alignment, and a system that is shaped
          more fully around her.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Who Phoenix is for</h2>
          <p style={bodyStyle}>
            Phoenix is for the woman who no longer wants to negotiate with
            friction and is ready for the most immersive level of support. She
            wants the system to move with her, not around her.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What it offers</h2>
          <div style={cardGridStyle}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Deep support</h3>
              <p style={cardTextStyle}>
                A higher-touch experience with deeper adaptation and refinement.
              </p>
            </div>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>More alignment</h3>
              <p style={cardTextStyle}>
                Built for women who need the strongest level of calibration.
              </p>
            </div>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Highest precision</h3>
              <p style={cardTextStyle}>
                The most immersive level of the system.
              </p>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>The feel of Phoenix</h2>
          <p style={bodyStyle}>
            Held. Adaptive. Inevitable. Phoenix is for the woman ready to step
            into the deepest version of the work.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/phoenix/cart" style={primaryButtonStyle}>
            Continue to Phoenix
          </a>
          <a href="/program" style={secondaryButtonStyle}>
            Return to Program
          </a>
        </div>
      </div>
    </main>
  )
}
