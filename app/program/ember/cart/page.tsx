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
} from '../../../styles/globalstyles'

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
              onClick={() => startCheckout('subscription')}
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
              onClick={() => startCheckout('annual')}
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

