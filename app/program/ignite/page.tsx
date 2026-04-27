'use client'

import type { CSSProperties } from 'react'

async function startCheckout(billing: 'subscription' | 'annual') {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      program: 'ignite',
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

export default function IgnitePage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Ignite</p>

        <h1 style={heroTitleStyle}>Guided. Corrective. Aligned.</h1>

        <p style={heroTextStyle}>
          Ignite is for the woman who has been trying, showing up, and doing the
          work — but needs the system corrected, explained, and structured around
          what actually creates progress.
        </p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Who Ignite is for</h2>
          <p style={bodyStyle}>
            Ignite is for the woman who does not need more pressure. She needs
            more clarity. She needs the why behind the structure, the environment
            aligned around the goal, and a system that helps her stop guessing.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>What it offers</h2>

          <div style={cardGridStyle}>
            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Structured guidance</h3>
              <p style={cardTextStyle}>
                The plan, plus the reasoning behind the plan in digestible pieces.
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>System correction</h3>
              <p style={cardTextStyle}>
                Designed for women who are consistent but not getting the response
                they should be getting.
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={cardTitleStyle}>Environmental alignment</h3>
              <p style={cardTextStyle}>
                Guidance that helps your daily life start supporting where your body
                and mind are going.
              </p>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>If this is you…</h2>
          <p style={bodyStyle}>
            If you’ve been consistent…
but your body stopped responding…

If you’ve been doing the work…
but still feel like you’re guessing…

If you’re tired of wondering
if you’re doing too much, too little,
or the wrong things entirely…

This is exactly where Ignite fits.
          </p>
        </section>
        
        <section style={cartBoxStyle}>
          <h2 style={sectionTitleStyle}>Begin Ignite</h2>
          <p style={bodyStyle}>
            Choose how you want to enter Ignite.
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
            <a href="/program/ember" style={secondaryButtonStyle}>
              Prefer simplicity? Explore Ember
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
