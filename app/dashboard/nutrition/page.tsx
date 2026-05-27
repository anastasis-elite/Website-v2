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
        zinc_target_mg: 8,
        selenium_target_mcg: 55,
        cholesterol_limit_mg: 300,
        choline_target_mg: 425,
        vitamin_a_target_mcg: 700,
        vitamin_c_target_mg: 75,
        vitamin_d_target_mcg: 15,
        vitamin_e_target_mg: 15,
        vitamin_k_target_mcg: 90,
        b1_target_mg: 1.1,
        b2_target_mg: 1.1,
        b3_target_mg: 14,
        b5_target_mg: 5,
        b6_target_mg: 1.3,
        b9_target_mcg: 400,
        b12_target_mcg: 2.4,
      })
      .select('*')
      .single()

    todayLog = newLog
  }

  const { data: remainingData } =
    todayLog?.id && hasAdvancedNutrition
      ? await supabase
          .from('nutrition_log_remaining')
          .select('*')
          .eq('nutrition_log_id', todayLog.id)
          .maybeSingle()
      : { data: null }

  const initialRemaining = remainingData || {
    calories_remaining: todayLog?.calories || calories,
    protein_remaining_g: todayLog?.protein || protein,
    carbs_remaining_g: todayLog?.carbs || carbs,
    fat_remaining_g: todayLog?.fats || fats,
    fiber_remaining_g: todayLog?.fiber_target_g || 30,
    sodium_remaining_mg: todayLog?.sodium_target_mg || 2300,
    potassium_remaining_mg: todayLog?.potassium_target_mg || 4700,
    magnesium_remaining_mg: todayLog?.magnesium_target_mg || 320,
    calcium_remaining_mg: todayLog?.calcium_target_mg || 1000,
    iron_remaining_mg: todayLog?.iron_target_mg || 18,
    zinc_remaining_mg: todayLog?.zinc_target_mg || 8,
    selenium_remaining_mcg: todayLog?.selenium_target_mcg || 55,
    cholesterol_remaining_mg: todayLog?.cholesterol_limit_mg || 300,
    choline_remaining_mg: todayLog?.choline_target_mg || 425,
    vitamin_a_remaining_mcg: todayLog?.vitamin_a_target_mcg || 700,
    vitamin_c_remaining_mg: todayLog?.vitamin_c_target_mg || 75,
    vitamin_d_remaining_mcg: todayLog?.vitamin_d_target_mcg || 15,
    vitamin_e_remaining_mg: todayLog?.vitamin_e_target_mg || 15,
    vitamin_k_remaining_mcg: todayLog?.vitamin_k_target_mcg || 90,
    b1_remaining_mg: todayLog?.b1_target_mg || 1.1,
    b2_remaining_mg: todayLog?.b2_target_mg || 1.1,
    b3_remaining_mg: todayLog?.b3_target_mg || 14,
    b5_remaining_mg: todayLog?.b5_target_mg || 5,
    b6_remaining_mg: todayLog?.b6_target_mg || 1.3,
    b9_remaining_mcg: todayLog?.b9_target_mcg || 400,
    b12_remaining_mcg: todayLog?.b12_target_mcg || 2.4,
  }

  const nutrition = {
    tdee,
    calories,
    protein,
    carbs,
    fats,
    water,
    micros: [
      'Fiber',
      'Sodium',
      'Potassium',
      'Magnesium',
      'Calcium',
      'Iron',
      'Zinc',
      'Selenium',
      'Choline',
      'Vitamin A',
      'Vitamin C',
      'Vitamin D',
      'Vitamin E',
      'Vitamin K',
      'B1',
      'B2',
      'B3',
      'B5',
      'B6',
      'B9',
      'B12',
    ],
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
          <>
            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>
                Food + Micronutrient Tracking
              </h2>

              <NutritionFoodLogger
                nutritionLogId={todayLog.id}
                initialRemaining={initialRemaining}
              />
            </section>

            {hasAdvancedNutrition && (
  <section style={styles.cartBoxStyle}>
    <h2 style={styles.sectionTitleStyle}>
      Micronutrients Remaining
    </h2>

    <div style={styles.compactCardGridStyle}>
      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Fiber
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.fiber_remaining_g}g remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Sodium
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.sodium_remaining_mg}mg remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Potassium
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.potassium_remaining_mg}mg remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Magnesium
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.magnesium_remaining_mg}mg remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Calcium
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.calcium_remaining_mg}mg remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Iron
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.iron_remaining_mg}mg remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Choline
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.choline_remaining_mg}mg remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Vitamin C
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.vitamin_c_remaining_mg}mg remaining
        </p>
      </div>

      <div style={styles.compactCardStyle}>
        <h3 style={styles.compactCardTitleStyle}>
          Vitamin D
        </h3>

        <p style={styles.compactCardTextStyle}>
          {initialRemaining.vitamin_d_remaining_mcg}mcg remaining
        </p>
      </div>
    </div>
  </section>
)}

            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>
                Recommended Recipes
              </h2>

              {nutrition.recipes.length ? (
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
