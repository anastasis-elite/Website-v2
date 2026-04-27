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

export default function MedicalReviewNeededPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Manual Review Required</p>

        <h1 style={heroTitleStyle}>Your application needs a quick safety review.</h1>

        <p style={bodyStyle}>
          Because you shared an injury, medical condition, or restriction, your application
          will be reviewed before a program recommendation is finalized.
        </p>

        <p style={bodyStyle}>
          If you uploaded medical clearance, it will be reviewed to confirm that it clearly
          supports participation in a structured fitness and nutrition program.
        </p>

        <p style={bodyStyle}>
          This protects both your progress and your safety. Once reviewed, you’ll receive the
          next appropriate step.
        </p>

        <a href="/program" style={primaryButtonStyle}>
          Review Programs
        </a>
      </div>
    </main>
  )
}

