import type { CSSProperties } from 'react'

export const pageStyle: CSSProperties = {
  background: '#000',
  color: '#f5f0e8',
  minHeight: '100vh',
  padding: '120px 24px',
}

export const containerStyle: CSSProperties = {
  maxWidth: '980px',
  margin: '0 auto',
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
  fontSize: '1.12rem',
  lineHeight: 1.9,
  color: '#d7c7b6',
  maxWidth: '780px',
  marginBottom: '56px',
}

export const sectionStyle: CSSProperties = {
  marginBottom: '72px',
}

export const sectionTitleStyle: CSSProperties = {
  fontSize: '1.7rem',
  marginBottom: '18px',
  fontWeight: 500,
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
  border: '1px solid rgba(197,139,87,0.18)',
  borderRadius: '24px',
  padding: '28px 24px',
  background: 'rgba(255,255,255,0.01)',
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
  border: '1px solid rgba(197,139,87,0.22)',
  borderRadius: '28px',
  padding: '32px',
  background: 'rgba(255,255,255,0.01)',
  marginBottom: '48px',
}

export const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
}

export const primaryButtonStyle: CSSProperties = {
  background: '#c58b57',
  color: '#000',
  padding: '14px 24px',
  borderRadius: '999px',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '1rem',
}

export const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #c58b57',
  color: '#f5f0e8',
  padding: '14px 24px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,
  opacity: 0.85,
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
  background: '#0a0a0a',
  color: '#f5f0e8',
  border: '1px solid rgba(197,139,87,0.22)',
  borderRadius: '16px',
  padding: '14px 16px',
  fontSize: '1rem',
  boxSizing: 'border-box',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '120px',
  resize: 'vertical',
}
