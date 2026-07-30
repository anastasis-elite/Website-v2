'use client'

import type { AgentRunnerMode } from '../runners/runner.types'

type AgentRunCardProps = {
  title: string
  description: string
  mode: AgentRunnerMode | 'daily'
  disabled: boolean
  onRun: (mode: AgentRunnerMode | 'daily') => void
}

export function AgentRunCard({ title, description, mode, disabled, onRun }: AgentRunCardProps) {
  return (
    <div style={cardStyle}>
      <div>
        <h3 style={titleStyle}>{title}</h3>
        <p style={bodyStyle}>{description}</p>
      </div>
      <button type="button" style={buttonStyle} disabled={disabled} onClick={() => onRun(mode)}>
        Run
      </button>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 8,
  padding: 16,
  background: 'rgba(255,255,255,0.05)',
  display: 'grid',
  gap: 14,
  minHeight: 150,
}

const titleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 18,
  lineHeight: 1.25,
  margin: 0,
}

const bodyStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 6,
  background: '#f6f1e8',
  color: '#171717',
  cursor: 'pointer',
  fontWeight: 700,
  minHeight: 40,
}
