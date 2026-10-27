import Link from 'next/link'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/detail-screens.css'
import { notFound } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNutrientInsights } from '@/lib/nutrition/getNutrientInsights'
import { canTrackMicronutrients } from '@/lib/nutrition/memberNutrition'

export default async function NutrientDetailPage({
  params,
}: {
  params: Promise<{ nutrient: string }>
}) {
  const { nutrient } = await params
  const { supabase, user, client } = await getDashboardContext()
  if (!canTrackMicronutrients(client.program)) notFound()

  const { data: nutrientRow } = await supabase
    .from('nutrients')
    .select('id,nutrient_key,canonical_name,aliases,category,default_unit,review_status,food_sources,physiological_functions,energy_role_categories,last_evidence_review_date')
    .eq('nutrient_key', nutrient)
    .maybeSingle()

  if (!nutrientRow) notFound()

  const [insight] = await getNutrientInsights({
    supabase,
    userId: user.id,
    clientId: client.client_id,
    limit: 8,
  }).then((items) => items.filter((item) => item.nutrientKey === nutrient))

  const { data: interactions } = await supabase
    .from('nutrient_interactions')
    .select('interaction_type,notes,last_reviewed_at,nutrient_reference_sources(title,url),related:nutrients!nutrient_interactions_related_nutrient_id_fkey(canonical_name,nutrient_key)')
    .eq('nutrient_id', nutrientRow.id)
    .not('last_reviewed_at', 'is', null)
    .limit(20)

  return (
    <PhoneAppFrame backHref="/dashboard/nutrition" backLabel="Nutrition" eyebrow="Nutrient Intelligence" title={nutrientRow.canonical_name} subtitle="Nutrient relationships provide context, not a diagnosis.">
      <main className="detail-content">
        <section className="detail-panel nutrient-detail-panel">
          <p className="tier-dashboard-label">Current Insight</p>
          <h2>{insight?.action.replaceAll('_', ' ') || 'No action'}</h2>
          <p>{insight?.message || 'No current insight is available.'}</p>
          <details className="nutrient-why-panel">
            <summary>Why am I seeing this?</summary>
            <ul>
              {(insight?.why || ['there is not enough converging nutrient-specific information yet']).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        </section>

        <section className="detail-panel nutrient-detail-panel">
          <p className="tier-dashboard-label">Reference Status</p>
          <h2>{nutrientRow.review_status === 'reviewed' ? 'Reviewed' : nutrientRow.review_status === 'partially_reviewed' ? 'Partially reviewed' : 'Review pending'}</h2>
          <small>
            Last evidence review: {nutrientRow.last_evidence_review_date || 'not completed'}
          </small>
        </section>

        <section className="detail-panel nutrient-detail-panel">
          <p className="tier-dashboard-label">Interactions</p>
          <h2>Reviewed Relationship Graph</h2>
          {interactions?.length ? (
            <div className="tier-info-grid">
              {interactions.map((interaction: any) => (
                <article key={`${interaction.interaction_type}-${interaction.related?.nutrient_key}`}>
                  <span>{interaction.interaction_type.replaceAll('_', ' ')}</span>
                  <strong>{interaction.related?.canonical_name}</strong>
                  <small>{interaction.notes}</small>
                  {interaction.nutrient_reference_sources?.url ? (
                    <Link href={interaction.nutrient_reference_sources.url}>Source</Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="tier-calendar-empty">No reviewed interactions have been loaded for this nutrient yet.</p>
          )}
        </section>

        <Link className="detail-action" href="/dashboard/nutrition">
          Back to nutrition
        </Link>
      </main>
    </PhoneAppFrame>
  )
}
