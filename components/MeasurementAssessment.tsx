'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type MeasurementKey =
  | 'bust_chest'
  | 'underbust'
  | 'left_upper_arm'
  | 'right_upper_arm'
  | 'left_forearm'
  | 'right_forearm'
  | 'shoulders'
  | 'neck'
  | 'waist'
  | 'hips_glutes'
  | 'left_thigh'
  | 'right_thigh'
  | 'left_calf'
  | 'right_calf'
  | 'lower_waist'
  | 'high_hip'
  | 'left_quad_sweep'
  | 'right_quad_sweep'
  | 'left_glute_fold'
  | 'right_glute_fold'
  | 'ribcage'
  | 'torso_length'
  | 'inseam'

type MeasurementField = {
  key: MeasurementKey
  label: string
  group: string
  description: string
  advanced?: boolean
}

const measurementFields: MeasurementField[] = [
  {
    key: 'bust_chest',
    label: 'Bust / Chest',
    group: 'Upper Body',
    description:
      'Measure directly over the fullest part of the breast/chest. For consistency, it is best to wear the same bra or similar support during each assessment.',
  },
  {
    key: 'underbust',
    label: 'Underbust',
    group: 'Upper Body',
    description:
      'Measure around the ribcage directly under the breast tissue. Keep the tape parallel to the floor and breathe normally.',
  },
  {
    key: 'left_upper_arm',
    label: 'Left Upper Arm',
    group: 'Upper Body',
    description:
      'Measure around the widest part of the upper arm. Keep the arm relaxed unless your program specifically instructs otherwise.',
  },
  {
    key: 'right_upper_arm',
    label: 'Right Upper Arm',
    group: 'Upper Body',
    description:
      'Measure around the widest part of the upper arm. Tracking both sides helps the system notice symmetry and development patterns.',
  },
  {
    key: 'left_forearm',
    label: 'Left Forearm',
    group: 'Upper Body',
    description:
      'Measure around the widest part of the forearm with the arm relaxed.',
  },
  {
    key: 'right_forearm',
    label: 'Right Forearm',
    group: 'Upper Body',
    description:
      'Measure around the widest part of the forearm with the arm relaxed.',
  },
  {
    key: 'shoulders',
    label: 'Shoulders',
    group: 'Upper Body',
    description:
      'Measure around the widest part of the shoulders and upper back. Keep posture natural and avoid pulling the tape too tight.',
  },
  {
    key: 'neck',
    label: 'Neck',
    group: 'Upper Body',
    description:
      'Measure around the base of the neck where it naturally meets the shoulders.',
  },
  {
    key: 'waist',
    label: 'Waist',
    group: 'Core',
    description:
      'Measure around the narrowest part of your natural waist. Keep the tape parallel to the floor. Do not suck in or brace your core. Breathe naturally before recording.',
  },
  {
    key: 'hips_glutes',
    label: 'Hips / Glutes',
    group: 'Lower Body',
    description:
      'Measure around the fullest part of your hips and glutes. Stand naturally with weight evenly distributed.',
  },
  {
    key: 'left_thigh',
    label: 'Left Thigh',
    group: 'Lower Body',
    description:
      'Measure around the fullest part of the thigh. Try to use the same distance from the hip or knee each time.',
  },
  {
    key: 'right_thigh',
    label: 'Right Thigh',
    group: 'Lower Body',
    description:
      'Measure around the fullest part of the thigh. Tracking both sides helps compare symmetry and compensation patterns.',
  },
  {
    key: 'left_calf',
    label: 'Left Calf',
    group: 'Lower Body',
    description:
      'Measure around the widest part of the calf while standing naturally.',
  },
  {
    key: 'right_calf',
    label: 'Right Calf',
    group: 'Lower Body',
    description:
      'Measure around the widest part of the calf while standing naturally.',
  },

  {
    key: 'lower_waist',
    label: 'Lower Waist / Lower Abdomen',
    group: 'Advanced Core',
    advanced: true,
    description:
      'Measure around the lower abdomen below the natural waist. This is optional and useful for more detailed inflammation, posture, or body composition tracking.',
  },
  {
    key: 'high_hip',
    label: 'High Hip',
    group: 'Advanced Core',
    advanced: true,
    description:
      'Measure around the high hip area, above the fullest part of the glutes and below the waist.',
  },
  {
    key: 'left_quad_sweep',
    label: 'Left Quad Sweep',
    group: 'Advanced Symmetry',
    advanced: true,
    description:
      'Measure around the upper thigh area where the quad sweep is most prominent.',
  },
  {
    key: 'right_quad_sweep',
    label: 'Right Quad Sweep',
    group: 'Advanced Symmetry',
    advanced: true,
    description:
      'Measure around the upper thigh area where the quad sweep is most prominent.',
  },
  {
    key: 'left_glute_fold',
    label: 'Left Glute Fold',
    group: 'Advanced Symmetry',
    advanced: true,
    description:
      'Measure at the lower glute/upper hamstring fold area. This is optional and intended for advanced physique tracking.',
  },
  {
    key: 'right_glute_fold',
    label: 'Right Glute Fold',
    group: 'Advanced Symmetry',
    advanced: true,
    description:
      'Measure at the lower glute/upper hamstring fold area. This is optional and intended for advanced physique tracking.',
  },
  {
    key: 'ribcage',
    label: 'Ribcage',
    group: 'Structural',
    advanced: true,
    description:
      'Measure around the ribcage, generally below the breast tissue and above the waist.',
  },
  {
    key: 'torso_length',
    label: 'Torso Length',
    group: 'Structural',
    advanced: true,
    description:
      'Measure from the base of the neck or shoulder line down to the natural waist. Keep posture natural.',
  },
  {
    key: 'inseam',
    label: 'Inseam',
    group: 'Structural',
    advanced: true,
    description:
      'Measure from the upper inner thigh down to the ankle or floor depending on your tracking purpose.',
  },
]

function getDefaultValues() {
  return measurementFields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = ''
    return acc
  }, {})
}

export default function MeasurementAssessment({
  clientId,
}: {
  clientId: string
}) {
  const [values, setValues] = useState(getDefaultValues)
  const [advancedEnabled, setAdvancedEnabled] = useState(false)
  const [activeKey, setActiveKey] = useState<MeasurementKey>('waist')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const activeField =
    measurementFields.find((field) => field.key === activeKey) ||
    measurementFields[0]

  const visibleFields = measurementFields.filter(
    (field) => !field.advanced || advancedEnabled
  )

  const groupedFields = visibleFields.reduce<Record<string, MeasurementField[]>>(
    (acc, field) => {
      if (!acc[field.group]) acc[field.group] = []
      acc[field.group].push(field)
      return acc
    },
    {}
  )

  function updateValue(key: MeasurementKey, value: string) {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }))

    setSaved(false)
  }

  async function saveMeasurements() {
    try {
      setSaving(true)
      setSaved(false)
      setError('')

      const cleanedMeasurements = Object.fromEntries(
        Object.entries(values)
          .filter(([, value]) => value !== '')
          .map(([key, value]) => [key, Number(value)])
      )

      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          advanced_enabled: advancedEnabled,
          measurements: cleanedMeasurements,
          notes,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Measurements could not be saved')
      }

      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Measurements could not be saved'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
          gap: '28px',
          alignItems: 'start',
        }}
      >
        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Measurement Inputs</h2>

          <p style={styles.bodyStyle}>
            Tap any measurement name to focus the diagram and see exactly where
            to measure. Record in inches unless your coach instructs otherwise.
          </p>

          <label
            style={{
              ...styles.bodyStyle,
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              marginTop: '18px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={advancedEnabled}
              onChange={(e) => setAdvancedEnabled(e.target.checked)}
              style={{
                accentColor: '#b56e43',
              }}
            />
            Enable advanced measurements
          </label>

          <div
            style={{
              display: 'grid',
              gap: '30px',
              marginTop: '30px',
            }}
          >
            {Object.entries(groupedFields).map(([group, fields]) => (
              <div key={group}>
                <p
                  style={{
                    ...styles.eyebrowStyle,
                    marginBottom: '14px',
                    letterSpacing: '3px',
                    fontSize: '10px',
                  }}
                >
                  {group}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gap: '16px',
                  }}
                >
                  {fields.map((field) => (
                    <div key={field.key} style={styles.fieldWrap}>
                      <button
                        type="button"
                        onClick={() => setActiveKey(field.key)}
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          color:
                            activeKey === field.key
                              ? '#c58b57'
                              : '#f5f0e8',
                          fontSize: '0.98rem',
                          lineHeight: 1.5,
                        }}
                      >
                        {field.label}
                      </button>

                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={values[field.key]}
                        onFocus={() => setActiveKey(field.key)}
                        onChange={(e) =>
                          updateValue(field.key, e.target.value)
                        }
                        placeholder="Inches"
                        style={styles.inputStyle}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...styles.fieldWrap, marginTop: '30px' }}>
            <label style={styles.labelStyle}>Notes</label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={styles.textareaStyle}
              placeholder="Anything that may affect today's measurements? Hydration, soreness, cycle phase, inflammation, digestion, etc."
            />
          </div>

          <button
            type="button"
            onClick={saveMeasurements}
            disabled={saving}
            style={{
              ...styles.primaryButtonStyle,
              marginTop: '24px',
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving
              ? 'Saving...'
              : saved
              ? 'Measurements Saved'
              : 'Save Measurements'}
          </button>

          {error ? (
            <p
              style={{
                ...styles.bodyStyle,
                color: '#ffb4b4',
                marginTop: '14px',
              }}
            >
              {error}
            </p>
          ) : null}
        </section>

        <aside
          style={{
            position: 'sticky',
            top: '110px',
            alignSelf: 'start',
          }}
        >
          <MeasurementDiagram
            activeKey={activeKey}
            activeField={activeField}
            onOpen={() => setOverlayOpen(true)}
          />
        </aside>
      </div>

      {overlayOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(18px)',
            padding: '32px',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 'min(100%, 980px)',
              maxHeight: '90vh',
              overflow: 'auto',
              background: 'rgba(10,10,10,0.92)',
              borderRadius: '34px',
              padding: '30px',
              boxShadow: '0 30px 120px rgba(0,0,0,0.55)',
            }}
          >
            <button
              type="button"
              onClick={() => setOverlayOpen(false)}
              style={{
                ...styles.secondaryButtonStyle,
                marginBottom: '24px',
              }}
            >
              Close
            </button>

            <MeasurementDiagram
              activeKey={activeKey}
              activeField={activeField}
              large
              onOpen={() => {}}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}

function MeasurementDiagram({
  activeKey,
  activeField,
  large = false,
  onOpen,
}: {
  activeKey: MeasurementKey
  activeField: MeasurementField
  large?: boolean
  onOpen: () => void
}) {
  const copper = '#c58b57'
  const muted = 'rgba(215,199,182,0.34)'
  const active = copper

  function lineColor(key: MeasurementKey) {
    return activeKey === key ? active : muted
  }

  return (
    <section
      onClick={onOpen}
      style={{
        background:
          'radial-gradient(circle at 50% 20%, rgba(181,110,67,0.10), transparent 36%), rgba(18,18,18,0.52)',
        borderRadius: '34px',
        padding: large ? '34px' : '24px',
        cursor: large ? 'default' : 'pointer',
        boxShadow:
          '0 24px 80px rgba(0,0,0,0.18), inset 0 0 30px rgba(255,255,255,0.015)',
      }}
    >
      <p
        style={{
          ...styles.eyebrowStyle,
          marginBottom: '12px',
          letterSpacing: '3px',
          fontSize: '10px',
        }}
      >
        Measurement Guide
      </p>

      <h3
        style={{
          margin: '0 0 8px',
          fontSize: large ? '1.6rem' : '1.1rem',
          fontWeight: 500,
          color: '#f5f0e8',
        }}
      >
        {activeField.label}
      </h3>

      <p
        style={{
          margin: '0 0 18px',
          color: 'rgba(215,199,182,0.76)',
          lineHeight: 1.65,
          fontSize: large ? '1rem' : '0.86rem',
        }}
      >
        {activeField.description}
      </p>

      <svg
  viewBox="0 0 320 620"
  style={{
    width: '100%',
    maxHeight: large ? '720px' : '500px',
    display: 'block',
  }}
>
  <defs>
    <filter id="softGlow">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  {/* Elegant female silhouette */}
  <path
    d="
      M160 36
      C139 36 123 53 123 75
      C123 98 139 115 160 115
      C181 115 197 98 197 75
      C197 53 181 36 160 36

      M145 116
      C143 132 136 144 124 156
      C104 176 94 205 96 236
      C98 266 110 286 122 304

      M175 116
      C177 132 184 144 196 156
      C216 176 226 205 224 236
      C222 266 210 286 198 304

      M124 156
      C134 174 146 182 160 182
      C174 182 186 174 196 156

      M124 174
      C116 205 117 238 130 268
      C138 287 148 296 160 298
      C172 296 182 287 190 268
      C203 238 204 205 196 174

      M130 268
      C116 306 104 352 96 398
      C89 440 91 486 99 548

      M190 268
      C204 306 216 352 224 398
      C231 440 229 486 221 548

      M151 298
      C145 352 143 410 139 470
      C136 513 130 548 121 588

      M169 298
      C175 352 177 410 181 470
      C184 513 190 548 199 588
    "
    fill="none"
    stroke="rgba(245,240,232,0.42)"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  />

  {/* Neck / collarbone */}
  <path
    d="M132 138 C145 150 175 150 188 138"
    fill="none"
    stroke="rgba(245,240,232,0.20)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  {/* Bust curve */}
  <path
    d="M122 214 C136 197 150 198 160 214 C170 198 184 197 198 214"
    fill="none"
    stroke="rgba(245,240,232,0.24)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  {/* Waist contour accent */}
  <path
    d="M129 268 C142 286 178 286 191 268"
    fill="none"
    stroke="rgba(245,240,232,0.18)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  {/* Hip / glute curve */}
  <path
    d="M104 336 C124 362 145 371 160 371 C175 371 196 362 216 336"
    fill="none"
    stroke="rgba(245,240,232,0.20)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  <GuideLine y={136} color={lineColor('neck')} label="Neck" />
  <GuideLine y={166} color={lineColor('shoulders')} label="Shoulders" />
  <GuideLine y={214} color={lineColor('bust_chest')} label="Chest" />
  <GuideLine y={242} color={lineColor('underbust')} label="Underbust" />
  <GuideLine y={292} color={lineColor('waist')} label="Waist" />
  <GuideLine y={322} color={lineColor('lower_waist')} label="Low Waist" />
  <GuideLine y={352} color={lineColor('high_hip')} label="High Hip" />
  <GuideLine y={374} color={lineColor('hips_glutes')} label="Hips" />

  <GuideLine
    y={460}
    color={
      activeKey === 'left_thigh' || activeKey === 'right_thigh'
        ? active
        : muted
    }
    label="Thigh"
  />

  <GuideLine
    y={548}
    color={
      activeKey === 'left_calf' || activeKey === 'right_calf'
        ? active
        : muted
    }
    label="Calf"
  />

  {/* Arm guides */}
  <line x1="84" y1="226" x2="116" y2="226" stroke={lineColor('left_upper_arm')} strokeWidth="4" strokeLinecap="round" />
  <line x1="204" y1="226" x2="236" y2="226" stroke={lineColor('right_upper_arm')} strokeWidth="4" strokeLinecap="round" />

  <line x1="88" y1="292" x2="120" y2="292" stroke={lineColor('left_forearm')} strokeWidth="4" strokeLinecap="round" />
  <line x1="200" y1="292" x2="232" y2="292" stroke={lineColor('right_forearm')} strokeWidth="4" strokeLinecap="round" />
</svg>

            {!large ? (
        <p
          style={{
            margin: '14px 0 0',
            color: 'rgba(197,139,87,0.86)',
            fontSize: '0.82rem',
          }}
        >
          Tap diagram for full guide →
        </p>
      ) : null}
    </section>
  )
}

function GuideLine({
  y,
  color,
  label,
}: {
  y: number
  color: string
  label: string
}) {
  return (
    <>
      <line
        x1="62"
        x2="250"
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />

      <text
        x="258"
        y={y + 4}
        fill={color}
        fontSize="10"
        fontFamily="Georgia, serif"
      >
        {label}
      </text>
    </>
  )
}
