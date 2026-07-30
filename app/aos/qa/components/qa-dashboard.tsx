'use client'

import { useEffect, useMemo, useState } from 'react'
import { AgentRunCard } from './agent-run-card'
import { ReportSummary } from './report-summary'
import { ScenarioResults } from './scenario-results'
import { ViolationTable } from './violation-table'
import type { QaAgentKind, QaReport } from '../reports/report.types'
import type { QaSeverity } from '../reports/severity'
import type { AgentRunnerMode } from '../runners/runner.types'

type ApiResponse = {
  ok: boolean
  report?: QaReport | null
  error?: string
}

export function QaDashboard({ initialReport }: { initialReport: QaReport | null }) {
  const [report, setReport] = useState<QaReport | null>(initialReport)
  const [seed, setSeed] = useState('')
  const [count, setCount] = useState(100)
  const [running, setRunning] = useState<AgentRunnerMode | 'daily' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agentFilter, setAgentFilter] = useState<QaAgentKind | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<QaSeverity | 'all'>('all')

  useEffect(() => {
    void refreshReport()
  }, [])

  const cards = useMemo(
    () => [
      {
        title: 'Functional QA Agent',
        description: 'Checks routes, action completion, response shape, state transitions, and adapter persistence.',
        mode: 'functional' as const,
      },
      {
        title: 'Logic Validation Agent',
        description: 'Compares adapter outcomes against deterministic Constitution rule evaluations.',
        mode: 'logic' as const,
      },
      {
        title: 'Experience QA Agent',
        description: 'Scores finite mental-load and workflow-friction heuristics from adapter evidence.',
        mode: 'experience' as const,
      },
      {
        title: 'Daily Simulation',
        description: 'Runs the default 100 deterministic synthetic client scenarios and aggregates one report.',
        mode: 'daily' as const,
      },
    ],
    [],
  )

  async function refreshReport() {
    const response = await fetch('/aos/qa/api/reports', { cache: 'no-store' })
    const payload = (await response.json()) as ApiResponse
    if (payload.ok && payload.report !== undefined) {
      setReport(payload.report)
    }
  }

  async function run(mode: AgentRunnerMode | 'daily') {
    setRunning(mode)
    setError(null)

    const endpoint = mode === 'daily' ? '/aos/qa/api/daily' : '/aos/qa/api/run'
    const body = mode === 'daily' ? { count, seed: seed || undefined } : { mode, count, seed: seed || undefined }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as ApiResponse

      if (!payload.ok || !payload.report) {
        setError(payload.error ?? 'QA run failed.')
        return
      }

      setReport(payload.report)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'QA run failed.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div style={pageStyle}>
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>Internal QA Tooling</p>
        <h2 style={headingStyle}>Anastasis Automated QA</h2>
        <p style={bodyStyle}>
          Local mock-adapter framework for functional checks, Constitution-driven logic validation,
          experience scoring, and daily synthetic client simulation.
        </p>
        <div style={controlsStyle}>
          <label style={labelStyle}>
            Seed
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="YYYY-MM-DD"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Personas
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
      </section>

      <section style={gridStyle}>
        {cards.map((card) => (
          <AgentRunCard
            key={card.mode}
            title={card.title}
            description={card.description}
            mode={card.mode}
            disabled={running !== null}
            onRun={run}
          />
        ))}
      </section>

      {running ? <p style={statusStyle}>Running {running} with the mock adapter...</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}

      <section style={sectionStyle}>
        <h2 style={subheadingStyle}>Most Recent Report</h2>
        <ReportSummary report={report} />
      </section>

      <section style={sectionStyle}>
        <h2 style={subheadingStyle}>Scenario Results</h2>
        <ScenarioResults report={report} />
      </section>

      <section style={sectionStyle}>
        <h2 style={subheadingStyle}>Violations</h2>
        <ViolationTable
          violations={report?.violations ?? []}
          agentFilter={agentFilter}
          severityFilter={severityFilter}
          onAgentFilter={setAgentFilter}
          onSeverityFilter={setSeverityFilter}
        />
      </section>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  display: 'grid',
  gap: 22,
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: 20,
  background: 'rgba(255,255,255,0.04)',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 16,
}

const eyebrowStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.56)',
  fontSize: 12,
  letterSpacing: 0,
  margin: '0 0 8px',
  textTransform: 'uppercase',
}

const headingStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 32,
  lineHeight: 1.1,
  margin: 0,
}

const subheadingStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: 22,
  lineHeight: 1.25,
  margin: '0 0 14px',
}

const bodyStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.74)',
  fontSize: 15,
  lineHeight: 1.55,
  maxWidth: 860,
}

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  display: 'grid',
  gap: 6,
  fontSize: 13,
}

const inputStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.18)',
  background: '#111',
  color: '#fff',
  padding: '0 10px',
}

const statusStyle: React.CSSProperties = {
  color: '#f6f1e8',
  margin: 0,
}

const errorStyle: React.CSSProperties = {
  color: '#ffb4a8',
  margin: 0,
}
