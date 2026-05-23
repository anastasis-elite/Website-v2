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
  viewBox="0 0 280 560"
  style={{
    width: '100%',
    maxHeight: large ? '680px' : '460px',
    display: 'block',
  }}
>
  {/* Female silhouette outline */}
  <path
    d="
      M140 34
      C122 34 108 49 108 68
      C108 87 122 102 140 102
      C158 102 172 87 172 68
      C172 49 158 34 140 34

      M124 103
      C121 118 116 130 104 142

      M156 103
      C159 118 164 130 176 142

      M104 142
      C82 154 68 182 66 218
      C64 246 72 270 82 294

      M176 142
      C198 154 212 182 214 218
      C216 246 208 270 198 294

      M106 144
      C116 158 126 166 140 166
      C154 166 164 158 174 144

      M104 158
      C92 188 94 218 108 246
      C116 262 124 270 132 274

      M176 158
      C188 188 186 218 172 246
      C164 262 156 270 148 274

      M108 246
      C102 278 96 312 88 344
      C82 368 74 396 72 430
      C70 470 76 510 82 532

      M172 246
      C178 278 184 312 192 344
      C198 368 206 396 208 430
      C210 470 204 510 198 532

      M132 274
      C124 322 120 370 118 426
      C116 470 112 506 104 536

      M148 274
      C156 322 160 370 162 426
      C164 470 168 506 176 536

      M118 426
      C108 462 98 500 92 544

      M162 426
      C172 462 182 500 188 544
    "
    fill="none"
    stroke="rgba(245,240,232,0.42)"
    strokeWidth="3.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />

  {/* Bust curve */}
  <path
    d="M108 188 C118 178 130 176 140 188 C150 176 162 178 172 188"
    fill="none"
    stroke="rgba(245,240,232,0.24)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  {/* Glute / hip curve */}
  <path
    d="M100 300 C114 320 126 326 140 326 C154 326 166 320 180 300"
    fill="none"
    stroke="rgba(245,240,232,0.20)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  <GuideLine y={116} color={lineColor('neck')} label="Neck" />
  <GuideLine y={146} color={lineColor('shoulders')} label="Shoulders" />
  <GuideLine y={190} color={lineColor('bust_chest')} label="Chest" />
  <GuideLine y={216} color={lineColor('underbust')} label="Underbust" />
  <GuideLine y={258} color={lineColor('waist')} label="Waist" />
  <GuideLine y={284} color={lineColor('lower_waist')} label="Low Waist" />
  <GuideLine y={316} color={lineColor('high_hip')} label="High Hip" />
  <GuideLine y={340} color={lineColor('hips_glutes')} label="Hips" />
  <GuideLine y={404} color={lineColor('left_thigh')} label="Thigh" />
  <GuideLine y={482} color={lineColor('left_calf')} label="Calf" />

  {/* Upper arm guides */}
  <line
    x1="67"
    y1="202"
    x2="96"
    y2="202"
    stroke={lineColor('left_upper_arm')}
    strokeWidth="4"
    strokeLinecap="round"
  />
  <line
    x1="184"
    y1="202"
    x2="213"
    y2="202"
    stroke={lineColor('right_upper_arm')}
    strokeWidth="4"
    strokeLinecap="round"
  />

  {/* Forearm guides */}
  <line
    x1="72"
    y1="260"
    x2="100"
    y2="260"
    stroke={lineColor('left_forearm')}
    strokeWidth="4"
    strokeLinecap="round"
  />
  <line
    x1="180"
    y1="260"
    x2="208"
    y2="260"
    stroke={lineColor('right_forearm')}
    strokeWidth="4"
    strokeLinecap="round"
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
  viewBox="0 0 280 560"
  style={{
    width: '100%',
    maxHeight: large ? '680px' : '460px',
    display: 'block',
  }}
>
  {/* Female silhouette outline */}
  <path
    d="
      M140 34
      C122 34 108 49 108 68
      C108 87 122 102 140 102
      C158 102 172 87 172 68
      C172 49 158 34 140 34

      M124 103
      C121 118 116 130 104 142

      M156 103
      C159 118 164 130 176 142

      M104 142
      C82 154 68 182 66 218
      C64 246 72 270 82 294

      M176 142
      C198 154 212 182 214 218
      C216 246 208 270 198 294

      M106 144
      C116 158 126 166 140 166
      C154 166 164 158 174 144

      M104 158
      C92 188 94 218 108 246
      C116 262 124 270 132 274

      M176 158
      C188 188 186 218 172 246
      C164 262 156 270 148 274

      M108 246
      C102 278 96 312 88 344
      C82 368 74 396 72 430
      C70 470 76 510 82 532

      M172 246
      C178 278 184 312 192 344
      C198 368 206 396 208 430
      C210 470 204 510 198 532

      M132 274
      C124 322 120 370 118 426
      C116 470 112 506 104 536

      M148 274
      C156 322 160 370 162 426
      C164 470 168 506 176 536

      M118 426
      C108 462 98 500 92 544

      M162 426
      C172 462 182 500 188 544
    "
    fill="none"
    stroke="rgba(245,240,232,0.42)"
    strokeWidth="3.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />

  {/* Bust curve */}
  <path
    d="M108 188 C118 178 130 176 140 188 C150 176 162 178 172 188"
    fill="none"
    stroke="rgba(245,240,232,0.24)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  {/* Glute / hip curve */}
  <path
    d="M100 300 C114 320 126 326 140 326 C154 326 166 320 180 300"
    fill="none"
    stroke="rgba(245,240,232,0.20)"
    strokeWidth="2"
    strokeLinecap="round"
  />

  <GuideLine y={116} color={lineColor('neck')} label="Neck" />
  <GuideLine y={146} color={lineColor('shoulders')} label="Shoulders" />
  <GuideLine y={190} color={lineColor('bust_chest')} label="Chest" />
  <GuideLine y={216} color={lineColor('underbust')} label="Underbust" />
  <GuideLine y={258} color={lineColor('waist')} label="Waist" />
  <GuideLine y={284} color={lineColor('lower_waist')} label="Low Waist" />
  <GuideLine y={316} color={lineColor('high_hip')} label="High Hip" />
  <GuideLine y={340} color={lineColor('hips_glutes')} label="Hips" />
  <GuideLine y={404} color={lineColor('left_thigh')} label="Thigh" />
  <GuideLine y={482} color={lineColor('left_calf')} label="Calf" />

  {/* Upper arm guides */}
  <line
    x1="67"
    y1="202"
    x2="96"
    y2="202"
    stroke={lineColor('left_upper_arm')}
    strokeWidth="4"
    strokeLinecap="round"
  />
  <line
    x1="184"
    y1="202"
    x2="213"
    y2="202"
    stroke={lineColor('right_upper_arm')}
    strokeWidth="4"
    strokeLinecap="round"
  />

  {/* Forearm guides */}
  <line
    x1="72"
    y1="260"
    x2="100"
    y2="260"
    stroke={lineColor('left_forearm')}
    strokeWidth="4"
    strokeLinecap="round"
  />
  <line
    x1="180"
    y1="260"
    x2="208"
    y2="260"
    stroke={lineColor('right_forearm')}
    strokeWidth="4"
    strokeLinecap="round"
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
        x1="54"
        x2="186"
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />

      <text
        x="192"
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
