'use client'

import { useEffect,useRef,useState } from 'react'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/assessments.css'
import AssessmentPhotoUpload from '@/components/AssessmentPhotoUpload'
import { memberAssessmentSections, memberSelections, memberFieldValid, validMemberSelections, type MemberAssessmentKind } from '@/lib/assessment/memberSelections'
import { getTierCapabilities } from '@/lib/entitlements'

type ClientData = {
  client_id: string
  full_name?: string
  email?: string
  birthdate?: string
  workout_days_available?: number | string
  equipment_access?: string[]
  experience_level?: string
  primary_goal?: string
  limitations?: string[]
  program?: string
}

export default function StartContent({ client, assessmentType = 'initial', savedAnswers = {}, canSubmit = true, notice, draftVersion }: {
  client: ClientData; assessmentType?: MemberAssessmentKind; savedAnswers?: Record<string, unknown>; canSubmit?: boolean; notice?: string; draftVersion?: string
}) {
  const [formData, setFormData] = useState(() => memberSelections(client, savedAnswers))
  const [draftRestored, setDraftRestored] = useState(false)
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const review = assessmentType === 'review'

  const lock=useRef(false);const draftKey=`anastasis-assessment:${client.client_id}:${assessmentType === 'quarterly' ? 'monthly' : assessmentType === 'review' ? `review:${draftVersion || 'current'}` : assessmentType}`;const [draftReady,setDraftReady]=useState(false)
  useEffect(() => {
    if (!canSubmit) return
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        setDraftRestored(true)
        setFormData(current => ({ ...current, ...Object.fromEntries(Object.entries(saved).filter(
          (entry): entry is [string, string] => entry[0] in current && typeof entry[1] === 'string'
            && !['client_id', 'program', 'fullName', 'email', 'birthdate'].includes(entry[0])
        )) }))
      }
    } catch {}
    setDraftReady(true)
  }, [draftKey, canSubmit])
  useEffect(()=>{if(canSubmit&&draftReady)try{localStorage.setItem(draftKey,JSON.stringify(formData))}catch{}},[canSubmit,draftReady,draftKey,formData])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if(lock.current || !canSubmit)return
    lock.current=true
    setStatus('submitting')
    setMessage('')

    try {
      const res = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          assessmentType,
          timestamp: new Date().toISOString(),
          source: 'dashboard-assessment',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Assessment submission failed')
      }

      localStorage.removeItem(draftKey)
      window.location.href = data.redirect || (assessmentType === 'initial' ? '/dashboard/assessment/start2' : '/dashboard/assessment/monthly')

    } catch (error) {
      console.error('ASSESSMENT ERROR:', error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally { lock.current=false }
  }



  return <PhoneAppFrame eyebrow={review ? 'Monthly Review' : 'Member assessment'} title={review ? 'Monthly Review' : assessmentType === 'quarterly' ? 'Quarterly Assessment' : 'Your starting point'} subtitle={review ? 'Still right for you?' : 'Your system, your life, your way.'}>
    <main className="assessment-content">
      {notice ? <p className="assessment-notice" role="status">{notice}</p> : null}
      <p className="assessment-notice">{review ? 'Review your saved selections. Edit only what’s changed.' : 'Your draft stays in this browser. Known profile information is prefilled. Complete each required selection and leave notes if there is anything else to consider.'}</p>
      {draftRestored ? <p className="assessment-notice" role="status">Unsaved selections from this browser were restored. They are not confirmed until you submit.</p> : null}
      <form onSubmit={handleSubmit} className="assessment-full-form">
        <input type="hidden" name="client_id" value={formData.client_id} readOnly />
        {memberAssessmentSections.map(section => {
          const missing = section.fields.some(field => !memberFieldValid(field.name, formData[field.name]))
          const open = !review || editing[section.title] || canSubmit && missing
          return <fieldset className="assessment-section" key={section.title} disabled={!canSubmit}>
            <legend>{section.title}</legend>
            {review ? <div className="assessment-review-heading"><p>{missing ? 'Some selections have not been recorded.' : 'Your saved selections'}</p>{canSubmit ? <button type="button" className="assessment-review-edit" aria-expanded={Boolean(open)} onClick={() => setEditing(current => ({...current,[section.title]:!open}))}>{open ? 'Done' : 'Edit'}</button> : null}</div> : null}
            {section.fields.map(field => open ? <label className="assessment-field" htmlFor={field.name} key={field.name}>
              {field.label} <small>Required</small>
              {'options' in field && field.options ? <select id={field.name} name={field.name} required value={formData[field.name]} onChange={handleChange}>
                <option value="">Select one</option>{field.options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select> : <textarea id={field.name} name={field.name} required value={formData[field.name]} onChange={handleChange} placeholder={'placeholder' in field ? field.placeholder : undefined} />}
            </label> : <div className="assessment-review-value" key={field.name}><span>{field.label}</span><strong>{'options' in field && field.options ? field.options.find(([value]) => value === formData[field.name])?.[1] || 'Not recorded' : formData[field.name] || 'Not recorded'}</strong></div>)}
          </fieldset>
        })}
        <fieldset className="assessment-section" disabled={!canSubmit}><legend>Notes</legend><label className="assessment-field" htmlFor="notes">Anything else you want the system to consider?
          <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Schedule constraints, preferences, fears, goals, or anything you want considered." />
        </label></fieldset>
        {canSubmit ? <button type="submit" disabled={status === 'submitting' || !validMemberSelections(formData)} className="assessment-action">{status === 'submitting' ? 'Submitting…' : review ? 'Confirm selections' : 'Submit Assessment'}</button> : null}
        {message ? <p role="alert">{message}</p> : null}
      </form>
      {!review ? <details className="assessment-section"><summary>Optional assessment photos</summary><AssessmentPhotoUpload postureAssessmentEnabled={getTierCapabilities(client.program).postureAssessment} /></details> : null}
    </main>
  </PhoneAppFrame>
}
