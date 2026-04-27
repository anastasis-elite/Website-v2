'use client'

import type { CSSProperties } from 'react'

async function startCheckout(billing: 'subscription' | 'annual') {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      program: 'phoenix',
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

export default function PhoenixPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Phoenix</p>

        <h1 style={heroTitleStyle}>Personalized. Precise. Built around you.</h1>

        <p style={heroTextStyle}>
          Phoenix is for the woman who is no longer here to guess. This is the
          deepest level of the system — personalized structure, deeper strategy,
          and quarterly 1:1 support built around your body, your goals, and your
          progression.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Who Phoenix is for</h2>
          <p style={bodyStyle}>
            Phoenix is for the woman who wants a more personalized experience,
            deeper calibration, and more direct strategic support. She is not
            looking for another generic plan. She wants the system shaped around
            where she is going.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What it offers</h2>

          <div style={cardGridStyle}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Personalized program direction</h3>
              <p style={cardTextStyle}>
                Customized program options based on the transformation you are building.
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>The science behind the structure</h3>
              <p style={cardTextStyle}>
                Deeper education around the system, your physiology, and the reason
                behind the progression.
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Quarterly 1:1 support</h3>
              <p style={cardTextStyle}>
                One private session per quarter to refine the direction and keep the
                system aligned with your evolution.
              </p>
            </div>
          </div>
        </section>

        <section style={cartBoxStyle}>
          <h2 style={sectionTitleStyle}>Begin Phoenix</h2>
          <p style={bodyStyle}>
            Choose how you want to enter Phoenix.
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
              Need a lighter level? Explore Ignite
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
