import Link from 'next/link'
import * as styles from '../../styles/globalstyles'
import NutritionTracker from '@/components/NutritionTracker'
import NutritionFoodLogger from '@/components/NutritionFoodLogger'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function NutritionPage() {
  const { supabase, client } = await getDashboardContext()

  const clientId = client.client_id
  const authUserId = client.auth_user_id
  const fullName = client.full_name || ''

  const layer = (
    client.layer ||
    client.program ||
    client.tier ||
    ''
  ).toLowerCase()

  const hasAdvancedNutrition =
    layer.includes('ignite') || layer.includes('phoenix')

  const today = new Date().toISOString().split('T')[0]

  const { data: strengthAssessment } = await supabase
    .from('assessments')
    .select('*')
    .eq('client_id', clientId)
    .eq('assessment_type', 'strength')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const assessmentData = strengthAssessment?.data || {}
  const weight = Number(assessmentData.weight || 0)

  const tdee = weight ? Math.round(weight * 12) : 2000
  const calories = tdee
  const protein = weight ? Math.round(weight * 0.8) : 150
  const fats = Math.round((calories * 0.28) / 9)
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4)
  const water = weight ? Math.round(weight * 0.6) : 100

  let { data: todayLog } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('client_id', clientId)
    .eq('log_date', today)
    .maybeSingle()

  if (!todayLog) {
    const { data: newLog } = await supabase
      .from('nutrition_logs')
      .insert({
        client_id: clientId,
        auth_user_id: authUserId,
        log_date: today,
        protein,
        carbs,
        fats,
        calories,
        water_oz: water,
        fiber_target_g: 30,
        sodium_target_mg: 2300,
        potassium_target_mg: 4700,
        magnesium_target_mg: 320,
        calcium_target_mg: 1000,
        iron_target_mg: 18,
        choline_target_mg: 425,
        vitamin_c_target_mg: 75,
        vitamin_d_target_mcg: 15,
      })
      .select('*')
      .single()

    todayLog = newLog
  }

  const { data: remainingData } = todayLog?.id
  ? await supabase
      .from('nutrition_log_remaining')
      .select('*')
      .eq('nutrition_log_id', todayLog.id)
      .maybeSingle()
  : { data: null }
  
  const nutrition = {
    tdee,
    calories,
    protein,
    carbs,
    fats,
    water,
    micros:
      'Prioritize magnesium, potassium, sodium, calcium, iron, B vitamins, vitamin D, omega-3 rich foods, and electrolytes.',
    recipes: [],
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Nutrition System</p>

        <h1 style={styles.heroTitleStyle}>
          {fullName
            ? `${fullName.split(' ')[0]}, here are your nutrition targets.`
            : 'Your nutrition targets.'}
        </h1>

        <p style={styles.heroTextStyle}>
          Your nutrition system is designed around your assessment data,
          recovery capacity, training demands, and current goal phase.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Energy Targets</h2>

          <p style={styles.bodyStyle}>
            <strong>TDEE:</strong> {nutrition.tdee || '—'}
          </p>

          <p style={styles.bodyStyle}>
            <strong>Recommended Calories:</strong>{' '}
            {nutrition.calories ? `${nutrition.calories} cal` : '—'}
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Macro Targets</h2>

          <p style={styles.bodyStyle}>
            <strong>Protein:</strong>{' '}
            {nutrition.protein ? `${nutrition.protein} g` : '—'}
          </p>

          <p style={styles.bodyStyle}>
            <strong>Carbohydrates:</strong>{' '}
            {nutrition.carbs ? `${nutrition.carbs} g` : '—'}
          </p>

          <p style={styles.bodyStyle}>
            <strong>Fats:</strong>{' '}
            {nutrition.fats ? `${nutrition.fats} g` : '—'}
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Hydration</h2>

          <p style={styles.bodyStyle}>
            <strong>Water Intake:</strong>{' '}
            {nutrition.water ? `${nutrition.water} oz` : '—'}
          </p>
        </section>

        {!hasAdvancedNutrition && (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Today’s Nutrition Log</h2>
            <NutritionTracker clientId={clientId} todayLog={todayLog} />
          </section>
        )}

        {hasAdvancedNutrition && todayLog?.id && (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>
              Food + Micronutrient Tracking
            </h2>

            <NutritionFoodLogger
              nutritionLogId={todayLog.id}
              initialRemaining={initialRemaining}    
            />
          </section>
        )}
            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>Micronutrients</h2>

              <p style={styles.bodyStyle}>
                {nutrition.micros ||
                  'No micronutrient recommendations yet.'}
              </p>
            </section>

            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>
                Recommended Recipes
              </h2>

              {nutrition.recipes?.length ? (
                <ul style={styles.bodyStyle}>
                  {nutrition.recipes.map((recipe, index) => (
                    <li key={index}>{recipe}</li>
                  ))}
                </ul>
              ) : (
                <p style={styles.bodyStyle}>
                  No recipes available yet.
                </p>
              )}
            </section>
          </>
        )}

        <div style={styles.buttonRowStyle}>
          <Link href="/dashboard" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
