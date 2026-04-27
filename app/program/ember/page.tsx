'use client'

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

async function startCheckout(billing: 'subscription' | 'annual') {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      program: 'ember',
      billing,
      email: '',
    }),
  })

  const data = await response.json()

  if (data.url) {
    window.location.href = data.url
  } else {
    alert(data.error || 'Unable to start checkout.')
  }
}

export default function EmberPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Ember</p>

        <h1 style={heroTitleStyle}>Structured. Precise. Self-led.</h1>

        <p style={heroTextStyle}>
          Ember is designed for the woman who already knows how to support herself,
          recover, regulate, and execute — but wants the numbers, structure, and
          progression calculated so she does not have to carry every decision alone.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Who Ember is for</h2>
          <p style={bodyStyle}>
            Ember is for the woman who is capable of moving independently. She does
            not need more noise, more chaos, or more hand-holding. She needs a clean
            structure that removes friction and lets her execute.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What it offers</h2>
          <div style={cardGridStyle}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Calculated structure</h3>
              <p style={cardTextStyle}>
                Training, progression, and foundational targets handled for you.
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Self-led execution</h3>
              <p style={cardTextStyle}>
                Ideal for women who want precision without high-touch oversight.
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Less decision fatigue</h3>
              <p style={cardTextStyle}>
                The system gives you the structure so you can stop overthinking the process.
              </p>
            </div>
          </div>
        </section>
        
       <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>If this is you…</h2>
          <p style={bodyStyle}>
            If you already know how to take care of yourself…

If you don’t need more information,
but you’re tired of making every decision alone…

If you want structure without losing autonomy…

This is exactly where Ember fits.
          </p>
        </section>
        
        <section style={cartBoxStyle}>
          <h2 style={sectionTitleStyle}>Begin Ember</h2>
          <p style={bodyStyle}>
            Choose how you want to enter Ember.
          </p>

          <div style={buttonRowStyle}>
            <button
              onClick={() => startCheckout('subscription')}
              style={primaryButtonStyle}
            >
              Choose Monthly
            </button>

            <button
              onClick={() => startCheckout('annual')}
              style={primaryButtonStyle}
            >
              Pay in Full
            </button>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Want a different level of support?</h2>

          <div style={buttonRowStyle}>
            <a href="/program/ignite" style={secondaryButtonStyle}>
              Need more structure? Explore Ignite
            </a>

            <a href="/program/phoenix" style={secondaryButtonStyle}>
              Want full personalization? Explore Phoenix
            </a>

            <a href="/program" style={secondaryButtonStyle}>
              Return to Program
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}

const pageStyle: CSSProperties = {
  background: '#000',
  color: '#f5f0e8',
  minHeight: '100vh',
  padding: '120px 24px',
}

const containerStyle: CSSProperties = {
  maxWidth: '980px',
  margin: '0 auto',
}

const eyebrowStyle: CSSProperties = {
  letterSpacing: '6px',
  fontSize: '12px',
  color: '#c58b57',
  opacity: 0.85,
  marginBottom: '24px',
  textTransform: 'uppercase',
}

const heroTitleStyle: CSSProperties = {
  fontSize: 'clamp(2.8rem, 5vw, 5rem)',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
  margin: '0 0 28px 0',
  maxWidth: '900px',
}

const heroTextStyle: CSSProperties = {
  fontSize: '1.12rem',
  lineHeight: 1.9,
  color: '#d7c7b6',
  maxWidth: '780px',
  marginBottom: '56px',
}

const sectionStyle: CSSProperties = {
  marginBottom: '72px',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.7rem',
  marginBottom: '18px',
  fontWeight: 500,
}

const bodyStyle: CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.05rem',
  maxWidth: '820px',
}

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '22px',
}

const cardStyle: CSSProperties = {
  border: '1px solid rgba(197,139,87,0.18)',
  borderRadius: '24px',
  padding: '28px 24px',
  background: 'rgba(255,255,255,0.01)',
}

const cardTitleStyle: CSSProperties = {
  fontSize: '1.2rem',
  marginBottom: '12px',
  fontWeight: 500,
}

const cardTextStyle: CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1.8,
  color: '#d7c7b6',
  margin: 0,
}

const cartBoxStyle: CSSProperties = {
  border: '1px solid rgba(197,139,87,0.22)',
  borderRadius: '28px',
  padding: '32px',
  background: 'rgba(255,255,255,0.01)',
  marginBottom: '72px',
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
}

const primaryButtonStyle: CSSProperties = {
  background: '#c58b57',
  color: '#000',
  padding: '14px 24px',
  borderRadius: '999px',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '1rem',
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #c58b57',
  color: '#f5f0e8',
  padding: '14px 24px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,
  opacity: 0.85,
}
