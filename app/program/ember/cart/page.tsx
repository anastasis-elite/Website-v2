'use client'

import type { CSSProperties } from 'react'

async function startCheckout(
  billing: 'subscription' | 'annual'
) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    alert(data.error || JSON.stringify(data))
  }
}

export default function EmberCartPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <p style={eyebrowStyle}>Checkout</p>

        <h1 style={heroTitleStyle}>Choose how you want to enter Ember.</h1>

        <p style={heroTextStyle}>
          Ember is your structured, self-led entry into the system. Choose the payment
          path that fits how you want to begin.
        </p>

        <section style={cardGridStyle}>
          <div style={cartBoxStyle}>
            <h2 style={sectionTitleStyle}>Monthly Subscription</h2>
            <p style={bodyStyle}>
              Ongoing access through a recurring monthly payment.
            </p>
            <button
              onClick={() => startCheckout('ember', 'subscription')}
              style={primaryButtonStyle}
            >
              Choose Monthly
            </button>
          </div>

          <div style={cartBoxStyle}>
            <h2 style={sectionTitleStyle}>Pay in Full</h2>
            <p style={bodyStyle}>
              One-time annual payment for the full year.
            </p>
            <button
              onClick={() => startCheckout('ember', 'annual')}
              style={primaryButtonStyle}
            >
              Choose Annual
            </button>
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '22px',
}

const cartBoxStyle: CSSProperties = {
  border: '1px solid rgba(197,139,87,0.22)',
  borderRadius: '28px',
  padding: '32px',
  background: 'rgba(255,255,255,0.01)',
}

const primaryButtonStyle: CSSProperties = {
  background: '#c58b57',
  color: '#000',
  padding: '14px 24px',
  borderRadius: '999px',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
}
