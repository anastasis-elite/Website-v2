import type { CSSProperties } from 'react'

export const pageStyle: CSSProperties = {
  background: 'transparent',
  color: '#f5f0e8',
  minHeight: '100vh',
  padding: '120px 24px',
}

export const containerStyle: CSSProperties = {
  maxWidth: '980px',
  margin: '0 auto',
  position: 'relative',
  zIndex: 2,
}

export const eyebrowStyle: CSSProperties = {
  letterSpacing: '6px',
  fontSize: '12px',
  color: '#c58b57',
  opacity: 0.85,
  marginBottom: '24px',
  textTransform: 'uppercase',
}

export const heroTitleStyle: CSSProperties = {
  fontSize: 'clamp(2.8rem, 5vw, 5rem)',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
  margin: '0 0 28px 0',
  maxWidth: '900px',
}

export const heroTextStyle: CSSProperties = {
  fontSize: '1.08rem',
  lineHeight: 1.95,
  color: 'rgba(215,199,182,0.82)',
  maxWidth: '760px',
  marginBottom: '72px',
}

export const sectionStyle: CSSProperties = {
  marginBottom: '92px',
}

export const sectionTitleStyle: CSSProperties = {
  fontSize: '1.55rem',
  marginBottom: '16px',
  fontWeight: 500,
  letterSpacing: '-0.02em',
}

export const bodyStyle: CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.05rem',
  maxWidth: '820px',
}

export const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '22px',
}

export const cardStyle: CSSProperties = {
  border: 'none',
  borderRadius: '28px',
  padding: '32px 28px',
  background: 'rgba(255,255,255,0.025)',

  boxShadow: `
    0 18px 60px rgba(0,0,0,0.16)
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
  color: '#d7c7b6',
  margin: 0,
}

export const cartBoxStyle: CSSProperties = {
  background: 'rgba(18,18,18,0.52)',
  border: 'none',
  borderRadius: '34px',
  padding: '38px',
  marginBottom: '36px',

  backdropFilter: 'blur(18px)',

  boxShadow: `
    0 24px 80px rgba(0,0,0,0.18),
    inset 0 0 30px rgba(255,255,255,0.015)
  `,
}

export const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
}

export const primaryButtonStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(181,110,67,0.58), rgba(120,72,44,0.46))',
  color: '#f5f0e8',
  padding: '15px 26px',
  borderRadius: '999px',
  border: 'none',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '1rem',
  boxShadow: '0 12px 34px rgba(120,72,44,0.16)',
  transition: 'all 0.22s ease',
}

export const secondaryButtonStyle: CSSProperties = {
  border: '1px solid rgba(181,110,67,0.28)',
  color: '#f5f0e8',
  padding: '14px 24px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,
  background: 'rgba(181,110,67,0.055)',
  backdropFilter: 'blur(12px)',
  transition: 'all 0.22s ease',
}

export const quietLinkStyle: CSSProperties = {
  color: '#c58b57',
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
  color: '#f5f0e8',
  fontSize: '0.96rem',
  lineHeight: 1.5,
}

export const h1Style: CSSProperties = {
  fontSize: '1.9rem',
  fontWeight: 700,
  marginTop: '64px',
  marginBottom: '16px',
  letterSpacing: '-0.01em',
  color: '#f5f0e8',
}

export const h2Style: CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 500,
  marginTop: '48px',
  marginBottom: '12px',
  letterSpacing: '-0.01em',
  color: '#f5f0e8',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,

  background: 'rgba(255,255,255,0.03)',

  color: '#f5f0e8',

  border: 'none',

  borderRadius: '18px',

  padding: '16px 18px',

  fontSize: '1rem',

  boxSizing: 'border-box',

  backdropFilter: 'blur(14px)',

  boxShadow: `
    inset 0 0 24px rgba(0,0,0,0.18)
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
  border: '1px solid rgba(181,110,67,0.12)',
  borderRadius: '22px',
  padding: '20px 18px',
  background: 'rgba(255,255,255,0.022)',
  boxShadow: `
    0 14px 44px rgba(0,0,0,0.14),
    inset 0 0 22px rgba(255,255,255,0.012)
  `,
}

export const compactCardTitleStyle: CSSProperties = {
  fontSize: '0.92rem',
  color: '#f5f0e8',
  margin: '0 0 8px 0',
  fontWeight: 500,
}

export const compactCardTextStyle: CSSProperties = {
  fontSize: '0.98rem',
  lineHeight: 1.5,
  color: '#d7c7b6',
  margin: 0,
}
