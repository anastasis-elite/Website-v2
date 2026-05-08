'use client'

import Link from 'next/link'
import * as styles from '../../styles/globalstyles'

export default function NutritionPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Nutrition System</p>

        <h1 style={styles.heroTitleStyle}>
          Your nutrition targets are being prepared.
        </h1>

        <p style={styles.heroTextStyle}>
          This page will eventually calculate and display your personalized energy,
          macro, micro, hydration, and recipe recommendations based on your assessment
          data and program phase.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Energy Target</h2>

          <p style={styles.bodyStyle}>
            <strong>Recommended Calories:</strong> Coming soon
          </p>

          <p style={styles.bodyStyle}>
            <strong>TDEE:</strong> Coming soon
          </p>

          <p style={styles.bodyStyle}>
            <strong>Goal Adjustment:</strong> Coming soon
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Macro Targets</h2>

          <p style={styles.bodyStyle}>
            <strong>Protein:</strong> Coming soon
          </p>

          <p style={styles.bodyStyle}>
            <strong>Carbohydrates:</strong> Coming soon
          </p>

          <p style={styles.bodyStyle}>
            <strong>Fats:</strong> Coming soon
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Micro Targets</h2>

          <p style={styles.bodyStyle}>
            Personalized micronutrient priorities will appear here once your nutrition
            engine is connected.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Hydration</h2>

          <p style={styles.bodyStyle}>
            <strong>Recommended Water Intake:</strong> Coming soon
          </p>

          <p style={styles.bodyStyle}>
            Electrolyte and training-day hydration recommendations will be added here.
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Recommended Recipes</h2>

          <p style={styles.bodyStyle}>
            Recipe links will be personalized based on calorie target, macro needs,
            digestion, schedule, and program phase.
          </p>
        </section>

        <div style={styles.buttonRowStyle}>
          <Link href="/dashboard/main" style={styles.secondaryButtonStyle}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
