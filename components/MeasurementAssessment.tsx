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
  viewBox="0 0 360 720"
  style={{
    width: '100%',
    maxHeight: large ? '760px' : '560px',
    display: 'block',
  }}
>
  {/* More natural woman silhouette */}
<path
  d="
    M180 58
    C156 58 140 78 140 104
    C140 130 156 150 180 150
    C204 150 220 130 220 104
    C220 78 204 58 180 58

    M165 150
    C164 174 156 198 139 218
    C124 235 104 238 92 250

    M195 150
    C196 174 204 198 221 218
    C236 235 256 238 268 250

    M92 250
    C82 264 78 294 80 332
    C82 374 76 420 70 466
    C68 486 76 502 90 510

    M268 250
    C278 264 282 294 280 332
    C278 374 284 420 290 466
    C292 486 284 502 270 510

    M113 248
    C106 296 110 342 128 378
    C140 402 158 414 180 414
    C202 414 220 402 232 378
    C250 342 254 296 247 248

    M128 378
    C110 416 96 466 96 520
    C96 574 107 632 124 688

    M232 378
    C250 416 264 466 264 520
    C264 574 253 632 236 688

    M166 414
    C160 474 156 536 152 598
    C149 640 143 674 136 704

    M194 414
    C200 474 204 536 208 598
    C211 640 217 674 224 704
  "
  fill="none"
  stroke="rgba(245,240,232,0.54)"
  strokeWidth="3"
  strokeLinecap="round"
  strokeLinejoin="round"
/>

{/* Hair / head detail */}
<path
  d="M150 82 C158 62 202 62 210 82"
  fill="none"
  stroke="rgba(245,240,232,0.34)"
  strokeWidth="2"
  strokeLinecap="round"
/>

{/* Collarbones */}
<path
  d="M110 252 C135 264 158 266 180 266 C202 266 225 264 250 252"
  fill="none"
  stroke="rgba(245,240,232,0.30)"
  strokeWidth="2"
  strokeLinecap="round"
/>

{/* Breast line */}
<path
  d="M119 312 C136 288 162 292 180 321 C198 292 224 288 241 312"
  fill="none"
  stroke="rgba(245,240,232,0.36)"
  strokeWidth="2"
  strokeLinecap="round"
/>

{/* Ribcage definition */}
<path
  d="M132 338 C145 356 162 365 180 365 C198 365 215 356 228 338"
  fill="none"
  stroke="rgba(245,240,232,0.26)"
  strokeWidth="2"
  strokeLinecap="round"
/>

<path
  d="M139 362 C151 376 166 383 180 383 C194 383 209 376 221 362"
  fill="none"
  stroke="rgba(245,240,232,0.22)"
  strokeWidth="2"
  strokeLinecap="round"
/>

{/* Waist / abdomen */}
<path
  d="M180 390 C180 405 180 420 180 436"
  fill="none"
  stroke="rgba(245,240,232,0.28)"
  strokeWidth="2"
  strokeLinecap="round"
/>

{/* Pelvis / hips */}
<path
  d="M112 445 C136 410 162 410 180 455 C198 410 224 410 248 445"
  fill="none"
  stroke="rgba(245,240,232,0.38)"
  strokeWidth="2"
  strokeLinecap="round"
/>

{/* Elbows */}
<circle cx="78" cy="392" r="7" fill="none" stroke="rgba(245,240,232,0.38)" strokeWidth="2" />
<circle cx="282" cy="392" r="7" fill="none" stroke="rgba(245,240,232,0.38)" strokeWidth="2" />

{/* Hands */}
<path
  d="M86 510 C75 520 75 540 91 552 C100 540 100 522 90 510"
  fill="none"
  stroke="rgba(245,240,232,0.38)"
  strokeWidth="2"
  strokeLinecap="round"
/>
<path
  d="M274 510 C285 520 285 540 269 552 C260 540 260 522 270 510"
  fill="none"
  stroke="rgba(245,240,232,0.38)"
  strokeWidth="2"
  strokeLinecap="round"
/>

{/* Knees */}
<path
  d="M128 556 C113 566 113 594 130 606 C147 594 147 566 128 556"
  fill="none"
  stroke="rgba(245,240,232,0.36)"
  strokeWidth="2"
/>
<path
  d="M232 556 C213 566 213 594 230 606 C247 594 247 566 232 556"
  fill="none"
  stroke="rgba(245,240,232,0.36)"
  strokeWidth="2"
/>

  <GuideLine y={190} color={lineColor('neck')} label="Neck" />
<GuideLine y={252} color={lineColor('shoulders')} label="Shoulders" />
<GuideLine y={314} color={lineColor('bust_chest')} label="Chest" />
<GuideLine y={348} color={lineColor('underbust')} label="Underbust" />
<GuideLine y={392} color={lineColor('waist')} label="Waist" />
<GuideLine y={430} color={lineColor('lower_waist')} label="Low Waist" />
<GuideLine y={458} color={lineColor('high_hip')} label="High Hip" />
<GuideLine y={496} color={lineColor('hips_glutes')} label="Hips" />

  <GuideLine
    y={548}
    color={
      activeKey === 'left_thigh' || activeKey === 'right_thigh'
        ? active
        : muted
    }
    label="Thigh"
  />

  <GuideLine
    y={650}
    color={
      activeKey === 'left_calf' || activeKey === 'right_calf'
        ? active
        : muted
    }
    label="Calf"
  />
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
        x1="72"
        x2="282"
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />

      <text
        x="292"
        y={y + 4}
        fill={color}
        fontSize="11"
        fontFamily="Georgia, serif"
      >
        {label}
      </text>
    </>
  )
}
