import {
  pageStyle,
  containerStyle,
  eyebrowStyle,
  heroTitleStyle,
  heroTextStyle,
  sectionStyle,
  sectionTitleStyle,
  bodyStyle,
  cardGridStyle,
  cardStyle,
  cardTitleStyle,
  cardTextStyle,
  cartBoxStyle,
  buttonRowStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  quietLinkStyle,
  gridTwoCol,
  fieldWrap,
  labelStyle,
  inputStyle,
  textareaStyle,

} from '../styles/globalstyles'

import type { CSSProperties } from 'react'

export default function MedicalClearancePage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Action Required</p>

        <h1 style={heroTitleStyle}>
          Medical clearance is required before moving forward.
        </h1>

        <p style={heroTextStyle}>
          Based on your responses, we need confirmation that it is safe for you to
          participate in a structured training program.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why this step matters</h2>
          <p style={bodyStyle}>
            This is not a limitation — it’s protection. Ensuring your body is cleared
            allows us to build your plan correctly and responsibly.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What to do next</h2>
          <p style={bodyStyle}>
            Please obtain written clearance from your healthcare provider and return
            to complete your application once you have it available.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/apply" style={primaryButtonStyle}>
            Return to Application
          </a>
        </div>
      </div>
    </main>
  )
}

