'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export default function DashboardProgressLinks({
  children,
}: {
  children?: ReactNode
}) {
  return (
    <section
      className="dashboard-progress-links"
      aria-labelledby="dashboard-progress-title"
      data-tutorial-id="dashboard-progress-area"
    >
      <div className="dashboard-progress-links__heading">
        <p>Progress</p>
        <h2 id="dashboard-progress-title">Periodic check-ins</h2>
      </div>

      <div className="dashboard-progress-links__grid">
        <Link
          href="/dashboard/assessment/photos"
          data-tutorial-id="dashboard-progress-photos"
        >
          <span aria-hidden="true">▧</span>
          <strong>Progress Photos</strong>
          <small>Upload visual progress. Posture photo analysis is coming soon.</small>
        </Link>

        <Link
          href="/dashboard/assessment/measurements"
          data-tutorial-id="dashboard-measurements"
        >
          <span aria-hidden="true">▥</span>
          <strong>Measurements</strong>
          <small>Log and review objective body measurement progress.</small>
        </Link>

        <Link
          href="/dashboard/assessment/start"
          data-tutorial-id="dashboard-strength-assessment"
        >
          <span aria-hidden="true">↟</span>
          <strong>Strength Assessment</strong>
          <small>Track functional progress separately from photos and measurements.</small>
        </Link>
      </div>

      {children ? (
        <div className="dashboard-progress-links__details">
          {children}
        </div>
      ) : null}
    </section>
  )
}
