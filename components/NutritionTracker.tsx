'use client'

import { useState } from 'react'

type Props = {
  clientId: string
  todayLog?: any
}

export default function NutritionTracker({ clientId, todayLog }: Props) {
  const [formData, setFormData] = useState({
    protein: todayLog?.protein || 0,
    carbs: todayLog?.carbs || 0,
    fats: todayLog?.fats || 0,
    calories: todayLog?.calories || 0,
    water_oz: todayLog?.water_oz || 0,
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function updateField(field: string, value: number) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function saveNutrition() {
    setSaving(true)

    try {
      const today = new Date().toISOString().split('T')[0]

      const res = await fetch('/api/nutrition-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          log_date: today,
          ...formData,
          completed: true,
        }),
      })

      if (!res.ok) {
        throw new Error('Nutrition save failed')
      }

      setSaved(true)
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      {[
        ['protein', 'Protein', 'grams'],
        ['carbs', 'Carbs', 'grams'],
        ['fats', 'Fats', 'grams'],
        ['calories', 'Calories', 'cal'],
        ['water_oz', 'Water', 'oz'],
      ].map(([field, label, unit]) => (
        <label key={field} style={{ display: 'grid', gap: 8 }}>
          {label}
          <input
            type="number"
            value={formData[field as keyof typeof formData]}
            placeholder={unit}
            onChange={(e) =>
              updateField(field, Number(e.target.value))
            }
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: '#080808',
              color: '#f3eee8',
              border: '1px solid rgba(181,110,67,0.35)',
            }}
          />
        </label>
      ))}

      <button
        type="button"
        onClick={saveNutrition}
        disabled={saving}
        style={{
          padding: '16px 24px',
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {saving
          ? 'Saving Nutrition...'
          : saved
          ? 'Nutrition Saved'
          : 'Save Nutrition'}
      </button>
    </section>
  )
}
