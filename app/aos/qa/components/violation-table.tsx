import type { QaAgentKind, QaViolation } from '../reports/report.types'
import type { QaSeverity } from '../reports/severity'

type ViolationTableProps = {
  violations: QaViolation[]
  agentFilter: QaAgentKind | 'all'
  severityFilter: QaSeverity | 'all'
  onAgentFilter: (agent: QaAgentKind | 'all') => void
  onSeverityFilter: (severity: QaSeverity | 'all') => void
}

const agents: Array<QaAgentKind | 'all'> = ['all', 'functional', 'logic', 'experience']
const severities: Array<QaSeverity | 'all'> = ['all', 'info', 'low', 'medium', 'high', 'critical']

export function ViolationTable({
  violations,
  agentFilter,
  severityFilter,
  onAgentFilter,
  onSeverityFilter,
}: ViolationTableProps) {
  const filtered = violations.filter((violation) => {
    const agentMatches = agentFilter === 'all' || violation.agent === agentFilter
    const severityMatches = severityFilter === 'all' || violation.severity === severityFilter
    return agentMatches && severityMatches
  })

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={filterRowStyle}>
        <label style={labelStyle}>
          Agent
          <select value={agentFilter} onChange={(event) => onAgentFilter(event.target.value as QaAgentKind | 'all')} style={selectStyle}>
            {agents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Severity
          <select
            value={severityFilter}
            onChange={(event) => onSeverityFilter(event.target.value as QaSeverity | 'all')}
            style={selectStyle}
          >
            {severities.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Agent</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Rule</th>
              <th style={thStyle}>Area</th>
              <th style={thStyle}>Violation</th>
              <th style={thStyle}>Expected</th>
              <th style={thStyle}>Actual</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((violation) => (
              <tr key={violation.id}>
                <td style={tdStyle}>{violation.agent}</td>
                <td style={tdStyle}>{violation.severity}</td>
                <td style={tdStyle}>{violation.ruleId ?? 'n/a'}</td>
                <td style={tdStyle}>{violation.area}</td>
                <td style={tdStyle}>
                  <strong style={{ color: '#fff' }}>{violation.title}</strong>
                  <span style={descriptionStyle}>{violation.description}</span>
                </td>
                <td style={tdStyle}>
                  <code style={codeStyle}>{stringify(violation.expected)}</code>
                </td>
                <td style={tdStyle}>
                  <code style={codeStyle}>{stringify(violation.actual)}</code>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td style={tdStyle} colSpan={7}>
                  No violations match the active filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function stringify(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

const filterRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  display: 'grid',
  gap: 6,
  fontSize: 13,
}

const selectStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.18)',
  background: '#111',
  color: '#fff',
  padding: '0 10px',
}

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 980,
}

const thStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.68)',
  fontSize: 12,
  textAlign: 'left',
  padding: 10,
  borderBottom: '1px solid rgba(255,255,255,0.12)',
}

const tdStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.76)',
  fontSize: 13,
  lineHeight: 1.45,
  padding: 10,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  verticalAlign: 'top',
}

const descriptionStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 4,
}

const codeStyle: React.CSSProperties = {
  color: '#f6f1e8',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}
