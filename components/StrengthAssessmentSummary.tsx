import Link from 'next/link'
import { formatStrengthAssessmentTimestamp, getStrengthAssessmentDetail, type StrengthAssessmentStatus } from '@/lib/assessment/getStrengthAssessmentStatus'

export default function StrengthAssessmentSummary({ status, client }: { status: StrengthAssessmentStatus; client: any }) {
  return (
    <article className="aos-card" aria-labelledby="strength-assessment-status-title">
      <p className="aos-eyebrow">Strength Assessment</p>
      <h2 id="strength-assessment-status-title">{status.label}</h2>
      <p>{getStrengthAssessmentDetail(status, client)}</p>
      <Link href={status.href} className="aos-primary-link">{status.actionLabel}</Link>
      {status.previousDraft ? (
        <p className="aos-muted-copy">
          An earlier draft is also available. Last saved {formatStrengthAssessmentTimestamp(status.previousDraft.savedAt, client, true)}.{' '}
          <Link href={status.previousDraft.href}>Resume earlier assessment</Link>
        </p>
      ) : null}
    </article>
  )
}
