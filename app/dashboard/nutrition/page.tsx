'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as styles from '../../styles/globalstyles'

type NutritionData = {
  tdee?: number | string
  calories?: number | string
  protein?: number | string
  carbs?: number | string
  fats?: number | string
  water?: number | string
  micros?: string
  recipes?: string[]
  error?: string
}

function NutritionContent() {
  const searchParams = useSearchParams()

  const clientId = searchParams.get('client_id') || ''
  const program = searchParams.get('program') || ''
  const fullName = searchParams.get('fullName') || ''

  const [nutrition, setNutrition] = useState<NutritionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNutrition() {
      try {
        const res = await fetch(
          `/api/nutrition?client_id=${encodeURIComponent(
            clientId
          )}&program=${encodeURIComponent(program)}`
        )

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Nutrition lookup failed')
        }

        setNutrition(data)
      } catch (error) {
        console.error('Nutrition load error:', error)

        setNutrition({
          error: 'Nutrition data is not available yet.',
        })
      } finally {
        setLoading(false)
      }
    }

    if (clientId) {
      loadNutrition()
    } else {
      setLoading(false)
    }
  }, [clientId, program])

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

        {loading ? (
          <section style={styles.cartBoxStyle}>
            <p style={styles.bodyStyle}>
              Loading nutrition targets...
            </p>
          </section>
        ) : nutrition?.error ? (
          <section style={styles.cartBoxStyle}>
            <p style={styles.bodyStyle}>
              {nutrition.error}
            </p>
          </section>
        ) : (
          <>
            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>Energy Targets</h2>

              <p style={styles.bodyStyle}>
                <strong>TDEE:</strong> {nutrition?.tdee || '—'}
              </p>

              <p style={styles.bodyStyle}>
                <strong>Recommended Calories:</strong> {nutrition?.calories || '—'}
              </p>
            </section>

            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>Macro Targets</h2>

              <p style={styles.bodyStyle}>
                <strong>Protein:</strong> {nutrition?.protein || '—'}
              </p>

              <p style={styles.bodyStyle}>
                <strong>Carbohydrates:</strong> {nutrition?.carbs || '—'}
              </p>

              <p style={styles.bodyStyle}>
                <strong>Fats:</strong> {nutrition?.fats || '—'}
              </p>
            </section>

            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>Hydration</h2>

              <p style={styles.bodyStyle}>
                <strong>Water Intake:</strong> {nutrition?.water || '—'}
              </p>
            </section>

            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>Micronutrients</h2>

              <p style={styles.bodyStyle}>
                {nutrition?.micros || 'No micronutrient recommendations yet.'}
              </p>
            </section>

            <section style={styles.cartBoxStyle}>
              <h2 style={styles.sectionTitleStyle}>Recommended Recipes</h2>

              {nutrition?.recipes?.length ? (
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
          <Link
            href={`/dashboard/main?program=${encodeURIComponent(
              program
            )}&client_id=${encodeURIComponent(
              clientId
            )}&fullName=${encodeURIComponent(fullName)}`}
            style={styles.secondaryButtonStyle}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function NutritionPage() {
  return (
    <Suspense fallback={null}>
      <NutritionContent />
    </Suspense>
  )
}
