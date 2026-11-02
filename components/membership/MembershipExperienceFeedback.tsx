'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { experienceMilestone, experienceResponse, type ExperienceResponse, type ExperienceState } from '@/lib/membership/experience'
import styles from './experience.module.css'

const ratingLabels: Record<number, string> = { 5: 'Very good', 4: 'Good', 3: 'Mixed', 2: 'Difficult', 1: 'Very difficult' }
const continuationLabels = { continue: 'I would like to continue', unsure: 'I am not sure yet', do_not_continue: 'I do not want to continue' }
type Submission = { milestoneId: string; requestId: string; response: ExperienceResponse }

export default function MembershipExperienceFeedback({ clientId, timeZone }: { clientId: string; timeZone: string }) {
  const id = useId()
  const [state, setState] = useState<ExperienceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [rating, setRating] = useState('')
  const [continuation, setContinuation] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [saved, setSaved] = useState(false)
  const submission = useRef<Submission | null>(null)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void fetch('/api/membership/experience', { cache: 'no-store', credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json().catch(() => null)
        if (!response.ok || data?.clientId !== clientId || typeof data.eligible !== 'boolean' || !Array.isArray(data.milestones)) throw new Error('Your check-ins could not be loaded. Please retry.')
        if (active) setState(data)
      })
      .catch(() => { if (active) setError('Your check-ins could not be loaded. Please retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId, reload])
  const current = state?.eligible && state.milestones.find(row => row.status === 'open' && row.can_respond && !row.feedback)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || saved || !current) return
    const response = experienceResponse({ rating: Number(rating), continuation, ...(comment.trim() ? { comment: comment.trim() } : {}) })
    if (!response) { setError('Choose an experience rating and continuation answer. Optional comments can be up to 2,000 characters.'); return }
    const body = submission.current || { milestoneId: current.id, requestId: crypto.randomUUID(), response }
    submission.current = body
    lock.current = true; setSaving(true); setAttempted(true); setError('')
    try {
      const result = await fetch('/api/membership/experience', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await result.json().catch(() => null)
      const confirmed = experienceMilestone(data?.milestone)
      if (!result.ok || data?.success !== true || data.clientId !== clientId || !confirmed || confirmed.id !== body.milestoneId || confirmed.status !== 'completed' || !confirmed.feedback || JSON.stringify(confirmed.feedback.response) !== JSON.stringify(body.response)) throw new Error('Your feedback save was not confirmed. Please retry with the same entries.')
      setState(previous => previous ? { ...previous, milestones: previous.milestones.map(row => row.id === confirmed.id ? confirmed : row) } : previous)
      setSaved(true)
    } catch { setError('Your feedback save was not confirmed. Please retry with the same entries.') }
    finally { lock.current = false; setSaving(false) }
  }

  return <section className={`${styles.card} ${styles.pageCard} ph-no-capture ph-sensitive`} aria-label="Your membership experience">
    <p>Saving feedback does not change your subscription. Subscription choices are available in <Link href="/dashboard/account#billing">billing management</Link>.</p>
    {loading ? <p role="status">Loading your check-ins…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {!loading && !state ? <button type="button" onClick={() => setReload(value => value + 1)}>Retry loading check-ins</button> : null}
    {saved ? <p role="status">Thank you. Your feedback is saved.</p> : !loading && current ? <form onSubmit={save} aria-busy={saving} autoComplete="off">
      <fieldset disabled={saving || attempted}>
        <legend>Your {current.months}-month check-in</legend>
        <label htmlFor={`${id}-rating`}>How has your membership experience been?<select id={`${id}-rating`} value={rating} required onChange={event => setRating(event.target.value)}><option value="">Choose one</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{ratingLabels[value]}</option>)}</select></label>
        <label htmlFor={`${id}-continuation`}>Would you like to continue?<select id={`${id}-continuation`} value={continuation} required onChange={event => setContinuation(event.target.value)}><option value="">Choose one</option>{Object.entries(continuationLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label htmlFor={`${id}-comment`}>Comments about your membership experience (optional)<textarea id={`${id}-comment`} value={comment} maxLength={2000} onChange={event => setComment(event.target.value)} /></label>
      </fieldset>
      {attempted && !saving ? <p className={styles.muted}>Your entries are kept unchanged for retry so the same response can be confirmed.</p> : null}
      <div className={styles.actions}><button type="submit" disabled={saving}>{saving ? 'Saving…' : attempted ? 'Retry saving feedback' : 'Save feedback'}</button><Link href="/dashboard">Maybe later</Link></div>
    </form> : !loading && state ? <p>No new membership check-in is available right now. Your saved feedback remains below.</p> : null}
    {(continuation === 'do_not_continue' || saved && submission.current?.response.continuation === 'do_not_continue') ? <p><Link href="/dashboard/account#billing">Open billing management</Link> to review your subscription choices.</p> : null}
    {state ? <section className={styles.history} aria-label="Saved membership feedback"><h2>Your check-in history</h2>
      {state.milestones.some(row => row.feedback) ? state.milestones.filter(row => row.feedback).map(row => <article key={row.id}>
        <h3>{row.months}-month check-in</h3>
        <time dateTime={row.feedback!.submitted_at}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone }).format(new Date(row.feedback!.submitted_at))}</time>
        <p>Experience: {ratingLabels[row.feedback!.response.rating]}</p><p>{continuationLabels[row.feedback!.response.continuation]}</p>
        {row.feedback!.response.comment ? <p>{row.feedback!.response.comment}</p> : null}
      </article>) : <p>No feedback has been saved yet.</p>}
    </section> : null}
  </section>
}
