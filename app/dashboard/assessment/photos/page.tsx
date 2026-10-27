import { notFound } from 'next/navigation'
import '@/components/phone-app/detail-screens.css'
import AssessmentPhotoUpload from '@/components/AssessmentPhotoUpload'
import ProgressPhotoComparison, { PhotoSetView } from '@/components/ProgressPhotoComparison'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getTierCapabilities } from '@/lib/entitlements'
import { getProgressPhotoComparison, signPhotoSet, photoViews } from '@/lib/assessment/photoComparison'
import '@/components/phone-app/assessments.css'

export default async function ProgressPhotosPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { supabase, client } = await getDashboardContext()
  const capabilities = getTierCapabilities(client.program)
  const postureMode = (await searchParams).type === 'posture'
  if (postureMode && !capabilities.postureAssessment) notFound()
  const [comparison, { data: records, error }] = await Promise.all([
    postureMode ? Promise.resolve(null) : getProgressPhotoComparison(supabase, client),
    supabase.from('assessment_photos').select('*').eq('client_id', client.client_id).eq('auth_user_id', client.auth_user_id).order('uploaded_at', { ascending: false }).limit(12),
  ])
  const history = await Promise.all((records || []).map((record: any) => signPhotoSet(supabase, client, record)))
  return <PhoneAppFrame backHref="/dashboard/assessment" backLabel="Assessments" eyebrow={postureMode ? 'Ignite & Phoenix' : 'Progress photos'} title={postureMode ? 'Posture Assessment' : 'See your progress'} subtitle={postureMode ? 'A clearer view of your alignment.' : 'Your first set beside your latest.'}>
    <main className={`assessment-content${postureMode ? ' posture-entry' : ''}`}>
      {comparison ? <ProgressPhotoComparison comparison={comparison} /> : null}
      {postureMode ? <AssessmentPhotoUpload key="posture" initialAssessmentType="posture" postureAssessmentEnabled={capabilities.postureAssessment} /> : <details className="assessment-section" id="add-photo-set"><summary className="assessment-action">Add a new photo set</summary><p>Your photos stay private.</p><AssessmentPhotoUpload key="progress" initialAssessmentType="progress" postureAssessmentEnabled={capabilities.postureAssessment} /></details>}
      {postureMode ? <p className="detail-note">Landmark confirmation: review the estimated points on each uploaded photo before confirming them.</p> : null}
      <details className="assessment-section"><summary>View recent photo sets</summary>
        <p>Up to 12 recent sets. Each set keeps its original date and views.</p>
        {error ? <p role="status">Photo history could not be loaded.</p> : !history.some(Boolean) ? <p>No photo history yet.</p> : history.map(set => set ? <section className="assessment-photo-history-set" key={set.id}><h2>{set.type === 'posture' ? 'Posture' : 'Progress'} · {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(set.date))}</h2><div className="assessment-photo-comparison">{photoViews.filter(view => set.views[view]).map(view => <PhotoSetView key={view} set={set} view={view} label={`${view[0].toUpperCase() + view.slice(1)} view`} />)}</div>{!Object.keys(set.views).length ? <p>Images unavailable in this saved set.</p> : null}</section> : null)}
      </details>
    </main>
  </PhoneAppFrame>
}
