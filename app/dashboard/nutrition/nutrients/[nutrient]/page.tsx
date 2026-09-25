import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getNutrientInsights } from '@/lib/nutrition/getNutrientInsights'

export default async function NutrientDetailPage({
  params,
}: {
  params: Promise<{ nutrient: string }>
}) {
  const { nutrient } = await params
  const { supabase, user, client } = await getDashboardContext()

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
    .select('interaction_type,notes,nutrient_reference_sources(title,url),related:nutrients!nutrient_interactions_related_nutrient_id_fkey(canonical_name,nutrient_key)')
    .eq('nutrient_id', nutrientRow.id)
    .limit(20)

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <header className="aos-flow-hero">
          <p className="aos-eyebrow">Nutrient Intelligence</p>
          <h1>{nutrientRow.canonical_name}</h1>
          <p>
            Vitamins and minerals support physiology; they do not provide calories.
            Anastasis uses reviewed relationships as context, not diagnosis.
          </p>
        </header>

        <section className="tier-info-panel nutrient-detail-panel">
          <p className="tier-dashboard-label">Current Insight</p>
          <h2>{insight?.action.replaceAll('_', ' ') || 'No action'}</h2>
          <p>{insight?.message || 'No nutrient-specific action is suggested from the currently available data.'}</p>
          <details className="nutrient-why-panel">
            <summary>Why am I seeing this?</summary>
            <ul>
              {(insight?.why || ['there is not enough converging nutrient-specific information yet']).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        </section>

        <section className="tier-info-panel nutrient-detail-panel">
          <p className="tier-dashboard-label">Reference Status</p>
          <h2>{nutrientRow.review_status.replaceAll('_', ' ')}</h2>
          <p>
            Authoritative RDA, AI, UL, symptom, and interaction records live in
            the nutrient reference tables so evidence can be reviewed without
            rewriting application logic.
          </p>
          <small>
            Last evidence review: {nutrientRow.last_evidence_review_date || 'not completed'}
          </small>
        </section>

        <section className="tier-info-panel nutrient-detail-panel">
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

        <Link className="tier-secondary-action" href="/dashboard/nutrition">
          Back to nutrition
        </Link>
      </div>
    </main>
  )
}
