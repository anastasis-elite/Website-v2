import type { QaReport } from '../reports/report.types'

type ReportSummaryProps = {
  report: QaReport | null
}

export function ReportSummary({ report }: ReportSummaryProps) {
  if (!report) {
    return <p style={bodyStyle}>No QA report has been generated in this server session.</p>
  }

  const metrics = [
    ['Run ID', report.runId],
    ['Seed', report.seed],
    ['Adapter', report.adapterName],
    ['Personas', String(report.personaCount)],
    ['Passed', String(report.scenariosPassed)],
    ['Failed', String(report.scenariosFailed)],
    ['Violations', String(report.violations.length)],
    ['Errors', String(report.errors.length)],
    ['Duration', `${report.durationMs}ms`],
  ]

  return (
    <div style={gridStyle}>
      {metrics.map(([label, value]) => (
        <div key={label} style={metricStyle}>
          <span style={labelStyle}>{label}</span>
          <strong style={valueStyle}>{value}</strong>
        </div>
      ))}
    </div>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 10,
}

const metricStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: 12,
  background: 'rgba(0,0,0,0.16)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.58)',
  fontSize: 12,
}

const valueStyle: React.CSSProperties = {
  display: 'block',
  color: '#fff',
  fontSize: 15,
  marginTop: 6,
  overflowWrap: 'anywhere',
}

const bodyStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  margin: 0,
}
