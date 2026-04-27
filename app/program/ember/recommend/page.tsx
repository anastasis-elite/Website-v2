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
} from '../../styles/globalstyles'
  
import type { CSSProperties } from 'react'

export default function EmberRecommendPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Recommended Path</p>

        <h1 style={heroTitleStyle}>
          You don’t need more information.
          <br />
          You need less thinking.
        </h1>

        <p style={heroTextStyle}>
          Ember was recommended because your answers suggest you already have the
          discipline, awareness, and ability to execute — you just need the structure
          handled for you.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Why Ember fits</h2>
          <p style={bodyStyle}>
            You’ve already learned pieces of what works. But carrying the daily weight
            of deciding how much, when, how often, and whether it’s enough creates
            friction.
          </p>

          <p style={bodyStyle}>
            Ember removes that friction. Your structure is calculated. Your numbers are
            set. Your execution becomes cleaner, simpler, and easier to sustain.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What Ember gives you</h2>
          <p style={bodyStyle}>
            Ember is the base layer — a precision execution system for women who are
            self-led and ready to stop wasting energy figuring everything out manually.
          </p>
        </section>

        <div style={buttonRowStyle}>
          <a href="/program/ember/cart" style={primaryButtonStyle}>
            Continue with Ember
          </a>

          <a href="/program/ignite" style={secondaryButtonStyle}>

    Want deeper support? Explore Ignite

  </a>

</div>
      </div>
    </main>
  )
}

