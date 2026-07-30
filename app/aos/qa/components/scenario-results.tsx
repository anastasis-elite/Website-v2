import type { QaReport } from '../reports/report.types'

type ScenarioResultsProps = {
  report: QaReport | null
}

export function ScenarioResults({ report }: ScenarioResultsProps) {
  if (!report) return null

  const severityEntries = Object.entries(report.severityTotals)
  const agentEntries = Object.entries(report.agentTotals)

  return (
    <div style={gridStyle}>
      <div style={panelStyle}>
        <h3 style={titleStyle}>Severity Totals</h3>
        {severityEntries.map(([severity, count]) => (
          <div key={severity} style={rowStyle}>
            <span>{severity}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div style={panelStyle}>
        <h3 style={titleStyle}>Agent Totals</h3>
        {agentEntries.map(([agent, count]) => (
          <div key={agent} style={rowStyle}>
            <span>{agent}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div style={panelStyle}>
        <h3 style={titleStyle}>Top Rules</h3>
        {report.topFailingRules.length ? (
          report.topFailingRules.map((rule) => (
            <div key={rule.ruleId} style={rowStyle}>
              <span>{rule.ruleId}</span>
              <strong>{rule.count}</strong>
            </div>
          ))
        ) : (
          <p style={bodyStyle}>No rule failures.</p>
        )}
      </div>
      <div style={panelStyle}>
        <h3 style={titleStyle}>Friction Points</h3>
        {report.topFrictionPoints.length ? (
          report.topFrictionPoints.map((point) => (
            <div key={point.area} style={rowStyle}>
              <span>{point.area}</span>
              <strong>{point.count}</strong>
            </div>
          ))
        ) : (
          <p style={bodyStyle}>No friction violations.</p>
        )}
      </div>
    </div>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const panelStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: 14,
  background: 'rgba(0,0,0,0.12)',
}

const titleStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 15,
  margin: '0 0 10px',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  color: 'rgba(255,255,255,0.74)',
  fontSize: 13,
  padding: '6px 0',
}

const bodyStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.64)',
  margin: 0,
  fontSize: 13,
}
