import type { CSSProperties } from 'react'

export const pageStyle: CSSProperties = {
  background: 'var(--anastasis-page-background)',
  color: 'var(--anastasis-ivory)',
  minHeight: '100vh',
  padding: '84px 18px calc(126px + env(safe-area-inset-bottom))',
}

export const containerStyle: CSSProperties = {
  maxWidth: '1080px',
  margin: '0 auto',
  position: 'relative',
  zIndex: 2,
}

export const eyebrowStyle: CSSProperties = {
  letterSpacing: '6px',
  fontSize: '12px',
  color: 'var(--anastasis-ivory)',
  opacity: 0.85,
  marginBottom: '24px',
  textTransform: 'uppercase',
}

export const heroTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.25rem, 2.8vw, 1.9rem)',
  lineHeight: 1.2,
  letterSpacing: '0',
  margin: '0 0 10px 0',
  maxWidth: '760px',
}

export const heroTextStyle: CSSProperties = {
  fontSize: '.9rem',
  lineHeight: 1.55,
  color: 'var(--anastasis-ivory)',
  maxWidth: '720px',
  marginBottom: '28px',
}

export const sectionStyle: CSSProperties = {
  marginBottom: '92px',
}

export const sectionTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.25rem, 2.8vw, 1.65rem)',
  marginBottom: '16px',
  fontWeight: 500,
  letterSpacing: '-0.02em',
}

export const bodyStyle: CSSProperties = {
  color: 'var(--anastasis-ivory)',
  lineHeight: 1.55,
  fontSize: '.9rem',
  maxWidth: '720px',
}

export const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '22px',
}

export const cardStyle: CSSProperties = {
  color: 'var(--anastasis-ivory)',
  border: 'none',
  borderRadius: '28px',
  padding: '32px 28px',
  background: 'var(--anastasis-charcoal)',

  boxShadow: `
    0 18px 60px rgba(12,12,12,0.16)
  `,
}

export const cardTitleStyle: CSSProperties = {
  fontSize: '1.2rem',
  marginBottom: '12px',
  fontWeight: 500,
}

export const cardTextStyle: CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1.8,
  color: 'var(--anastasis-ivory)',
  margin: 0,
}

export const cartBoxStyle: CSSProperties = {
  color: 'var(--anastasis-ivory)',
  background: 'var(--anastasis-charcoal)',
  border: '1px solid var(--anastasis-copper)',
  borderRadius: '22px',
  padding: 'clamp(18px,2.6vw,24px)',
  marginBottom: '22px',
  backdropFilter: 'blur(18px)',
  boxShadow: `
    0 20px 50px rgba(12,12,12,.33),
    inset 0 1px rgba(245,241,232,.025)
  `,
}

export const innerCardStyle = {
  color: 'var(--anastasis-ivory)',
  padding: '20px',
  borderRadius: '22px',
  background: 'var(--anastasis-charcoal)',
  border: '1px solid var(--anastasis-copper)',
} as const

export const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
}

export const primaryButtonStyle: CSSProperties = {
  background: 'var(--anastasis-action-background)',
  color: 'var(--anastasis-action-text)',
  padding: '15px 26px',
  borderRadius: '999px',
  border: '1px solid var(--anastasis-action-border)',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '1rem',
  boxShadow: '0 12px 34px rgba(12,12,12,0.16)',
  transition: 'all 0.22s ease',
}

export const secondaryButtonStyle: CSSProperties = {
  border: '1px solid var(--anastasis-copper)',
  color: 'var(--anastasis-ivory)',
  padding: '14px 24px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,
  background: 'transparent',
  backdropFilter: 'blur(12px)',
  transition: 'all 0.22s ease',
}

export const quietLinkStyle: CSSProperties = {
  color: 'var(--anastasis-ivory)',
  fontSize: '0.9rem',
  opacity: 0.7,
  textDecoration: 'underline',
  cursor: 'pointer',
  display: 'inline-block',
  marginTop: '8px',
}

export const gridTwoCol: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: '18px',
}

export const fieldWrap: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minWidth: 0,
}

export const labelStyle: CSSProperties = {
  color: 'var(--anastasis-ivory)',
  fontSize: '0.96rem',
  lineHeight: 1.5,
}

export const h1Style: CSSProperties = {
  fontSize: '1.9rem',
  fontWeight: 700,
  marginTop: '64px',
  marginBottom: '16px',
  letterSpacing: '-0.01em',
  color: 'var(--anastasis-ivory)',
}

export const h2Style: CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 500,
  marginTop: '48px',
  marginBottom: '12px',
  letterSpacing: '-0.01em',
  color: 'var(--anastasis-ivory)',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,

  background: 'var(--anastasis-charcoal)',

  color: 'var(--anastasis-ivory)',

  border: 'none',

  borderRadius: '18px',

  padding: '16px 18px',

  fontSize: '1rem',

  boxSizing: 'border-box',

  backdropFilter: 'blur(14px)',

  boxShadow: `
    inset 0 0 24px rgba(12,12,12,0.18)
  `,
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '120px',
  resize: 'vertical',
}

export const compactCardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '14px',
}

export const compactCardStyle: CSSProperties = {
  color: 'var(--anastasis-ivory)',
  border: '1px solid var(--anastasis-copper)',
  borderRadius: '22px',
  padding: '20px 18px',
  background: 'var(--anastasis-charcoal)',
  boxShadow: `
    0 14px 44px rgba(12,12,12,0.14),
    inset 0 0 22px rgba(245,241,232,0.012)
  `,
}

export const compactCardTitleStyle: CSSProperties = {
  fontSize: '0.92rem',
  color: 'var(--anastasis-ivory)',
  margin: '0 0 8px 0',
  fontWeight: 500,
}

export const compactCardTextStyle: CSSProperties = {
  fontSize: '0.98rem',
  lineHeight: 1.5,
  color: 'var(--anastasis-ivory)',
  margin: 0,
}

export const checkboxRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  lineHeight: 1.7,
  color: 'var(--anastasis-ivory)',
  fontSize: '0.98rem',
  cursor: 'pointer',
}

export const checkboxInputStyle: CSSProperties = {
  marginTop: '4px',
  accentColor: 'var(--anastasis-flame)',
}
