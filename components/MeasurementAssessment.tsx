'use client'

import { useEffect, useRef, useState } from 'react'
import '@/components/phone-app/assessments.css'
import * as styles from '@/app/styles/globalstyles'

type MeasurementKey =
  | 'weight'
  | 'left_triceps_skinfold_mm'
  | 'right_triceps_skinfold_mm'
  | 'left_biceps_skinfold_mm'
  | 'right_biceps_skinfold_mm'
  | 'abdominal_skinfold_mm'
  | 'suprailiac_skinfold_mm'
  | 'left_thigh_skinfold_mm'
  | 'right_thigh_skinfold_mm'
  | 'left_calf_skinfold_mm'
  | 'right_calf_skinfold_mm'
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
  | 'height'
  | 'left_shoulder_to_elbow'
  | 'right_shoulder_to_elbow'
  | 'left_elbow_to_wrist'
  | 'right_elbow_to_wrist'
  | 'left_hip_to_knee'
  | 'right_hip_to_knee'
  | 'left_knee_to_ankle'
  | 'right_knee_to_ankle'

type MeasurementField = {
  key: MeasurementKey
  label: string
  group: string
  description: string
  unit?: 'in' | 'lb' | 'mm'
  advanced?: boolean
}

const measurementFields: MeasurementField[] = [
  {
    key: 'weight',
    label: 'Measured Body Weight',
    group: 'Scale',
    unit: 'lb',
    description:
      'Record the current scale weight from the same scale and similar conditions when possible. Your saved entries provide a record to compare over time.',
  },
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
      'Measure around the widest part of the upper arm. Recording both sides keeps separate left and right measurements in your history.',
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
      'Measure around the fullest part of the thigh. Recording both sides keeps separate left and right measurements in your history.',
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
      'Measure around the lower abdomen below the natural waist. This optional entry adds another measurement to your history.',
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
    key: 'left_triceps_skinfold_mm',
    label: 'Left Triceps Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the left posterior upper-arm skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'right_triceps_skinfold_mm',
    label: 'Right Triceps Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the right posterior upper-arm skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'left_biceps_skinfold_mm',
    label: 'Left Biceps Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the left anterior upper-arm skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'right_biceps_skinfold_mm',
    label: 'Right Biceps Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the right anterior upper-arm skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'abdominal_skinfold_mm',
    label: 'Abdominal Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the abdominal skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'suprailiac_skinfold_mm',
    label: 'Suprailiac Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the suprailiac skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'left_thigh_skinfold_mm',
    label: 'Left Thigh Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the left anterior thigh skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'right_thigh_skinfold_mm',
    label: 'Right Thigh Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the right anterior thigh skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'left_calf_skinfold_mm',
    label: 'Left Calf Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the left medial calf skinfold in millimeters when a caliper measurement is available.',
  },
  {
    key: 'right_calf_skinfold_mm',
    label: 'Right Calf Skinfold',
    group: 'Advanced Skinfolds',
    unit: 'mm',
    advanced: true,
    description:
      'Record the right medial calf skinfold in millimeters when a caliper measurement is available.',
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
    key: 'height',
    label: 'Height',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Record standing height in the same conditions each time when possible.',
  },
  {
    key: 'left_shoulder_to_elbow',
    label: 'Left Shoulder to Elbow',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the shoulder/acromion landmark to the elbow on the left side.',
  },
  {
    key: 'right_shoulder_to_elbow',
    label: 'Right Shoulder to Elbow',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the shoulder/acromion landmark to the elbow on the right side.',
  },
  {
    key: 'left_elbow_to_wrist',
    label: 'Left Elbow to Wrist',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the elbow landmark to the wrist landmark on the left side.',
  },
  {
    key: 'right_elbow_to_wrist',
    label: 'Right Elbow to Wrist',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the elbow landmark to the wrist landmark on the right side.',
  },
  {
    key: 'left_hip_to_knee',
    label: 'Left Hip to Knee',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the hip or pelvic landmark to the knee landmark on the left side.',
  },
  {
    key: 'right_hip_to_knee',
    label: 'Right Hip to Knee',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the hip or pelvic landmark to the knee landmark on the right side.',
  },
  {
    key: 'left_knee_to_ankle',
    label: 'Left Knee to Ankle',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the knee landmark to the ankle landmark on the left side.',
  },
  {
    key: 'right_knee_to_ankle',
    label: 'Right Knee to Ankle',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the knee landmark to the ankle landmark on the right side.',
  },
  {
    key: 'ribcage',
    label: 'Ribcage',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure around the ribcage, generally below the breast tissue and above the waist.',
  },
  {
    key: 'torso_length',
    label: 'Torso Length',
    group: '9-Month Structural',
    advanced: true,
    description:
      'Measure from the base of the neck or shoulder line down to the natural waist. Keep posture natural.',
  },
  {
    key: 'inseam',
    label: 'Inseam',
    group: '9-Month Structural',
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

export default function MeasurementAssessment({ clientId }: { clientId: string }) {
  const [values, setValues] = useState(getDefaultValues)
  const [advancedEnabled, setAdvancedEnabled] = useState(false)
  const [activeKey, setActiveKey] = useState<MeasurementKey>('waist')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const guideDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (overlayOpen) guideDialog.current?.showModal() }, [overlayOpen])
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
        headers: { 'Content-Type': 'application/json' },
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

  const groups = Object.entries(groupedFields)
  const standardOrder = ['Scale', 'Core', 'Upper Body', 'Lower Body']
  const renderGroup = ([group, fields]: [string, MeasurementField[]]) => <fieldset className="assessment-section measurement-group" key={group}>
    <legend>{group}</legend>
    {fields.map(field => <div className="measurement-row" key={field.key}>
      <button type="button" id={`${field.key}-label`} onClick={() => setActiveKey(field.key)} aria-pressed={activeKey === field.key}>{field.label}</button>
      <div className="measurement-unit-input"><input id={`measurement-${field.key}`} aria-labelledby={`${field.key}-label`} type="number" min="0" step="0.25" value={values[field.key]} onFocus={() => setActiveKey(field.key)} onChange={event => updateValue(field.key, event.target.value)} /><span>{field.unit || 'in'}</span></div>
    </div>)}
  </fieldset>

  return <div className="assessment-content measurement-assessment">
    <MeasurementDiagram activeKey={activeKey} activeField={activeField} onOpen={() => setOverlayOpen(true)} />
    <p className="assessment-notice">Tap a measurement name to highlight its location on the guide. Monthly regional measurements and 9-month structural lengths keep their own schedules.</p>
    {groups.filter(([, fields]) => !fields[0].advanced).sort(([a], [b]) => standardOrder.indexOf(a) - standardOrder.indexOf(b)).map(renderGroup)}
    <label className="assessment-section measurement-advanced"><input type="checkbox" checked={advancedEnabled} onChange={event => setAdvancedEnabled(event.target.checked)} /><span>Enable advanced measurements<small>Additional measurements when needed.</small></span></label>
    {groups.filter(([, fields]) => fields[0].advanced).map(renderGroup)}
    <fieldset className="assessment-section"><legend>Notes</legend><label className="assessment-field" htmlFor="measurement-notes">Optional
      <textarea id="measurement-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Anything that may affect today's measurements? Hydration, soreness, cycle phase, digestion, recovery, etc." />
    </label></fieldset>
    <button type="button" onClick={saveMeasurements} disabled={saving} className="assessment-action">{saving ? 'Saving…' : saved ? 'Measurements Saved' : 'Save Measurements'}</button>
    {error ? <p role="alert">{error}</p> : null}
    {saved ? <p role="status">Your measurements were saved.</p> : null}
    {overlayOpen ? <dialog ref={guideDialog} className="phone-app-practice-dialog measurement-dialog" aria-label="Full measurement guide" onCancel={() => setOverlayOpen(false)} onClose={() => setOverlayOpen(false)}>
      <button type="button" className="assessment-action" onClick={() => guideDialog.current?.close()}>Close guide</button>
      <MeasurementDiagram activeKey={activeKey} activeField={activeField} large onOpen={() => {}} />
    </dialog> : null}
  </div>
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
      className={large ? 'measurement-guide measurement-guide-large' : 'measurement-guide'}
      role={large ? undefined : 'button'}
      tabIndex={large ? undefined : 0}
      aria-label={large ? undefined : 'Open full measurement guide'}
      onKeyDown={large ? undefined : event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}
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

     <div
  style={{
    position: 'relative',
    width: '100%',
    aspectRatio: '360 / 720',
  }}
>
  <img
    src="/woman-silhouette.png"
    alt="Woman measurement guide silhouette"
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      display: 'block',
      opacity: 0.92,
      objectFit: 'contain',
    }}
  />

  <svg
    viewBox="0 0 360 720"
    preserveAspectRatio="xMidYMid meet"
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    }}
  >
          <GuideLine y={160} color={lineColor('neck')} label="Neck" />
          <GuideLine y={195} color={lineColor('shoulders')} label="Shoulders" />
          <GuideLine y={225} color={lineColor('bust_chest')} label="Chest" />
          <GuideLine y={240} color={lineColor('underbust')} label="Underbust" />
          <GuideLine y={275} color={lineColor('waist')} label="Waist" />
          <GuideLine y={325} color={lineColor('high_hip')} label="High Hip" />
          <GuideLine y={350} color={lineColor('hips_glutes')} label="Hips" />

          <GuideLine
            y={400}
            color={
              activeKey === 'left_thigh' || activeKey === 'right_thigh'
                ? active
                : muted
            }
            label="Thigh"
          />

          <GuideLine
            y={525}
            color={
              activeKey === 'left_calf' || activeKey === 'right_calf'
                ? active
                : muted
            }
            label="Calf"
          />

          <line
            x1="72"
            x2="118"
            y1="292"
            y2="292"
            stroke={lineColor('left_upper_arm')}
            strokeWidth="4"
            strokeLinecap="round"
          />

          <line
            x1="242"
            x2="288"
            y1="292"
            y2="292"
            stroke={lineColor('right_upper_arm')}
            strokeWidth="4"
            strokeLinecap="round"
          />

          <line
            x1="68"
            x2="112"
            y1="400"
            y2="400"
            stroke={lineColor('left_forearm')}
            strokeWidth="4"
            strokeLinecap="round"
          />

          <line
            x1="248"
            x2="292"
            y1="400"
            y2="400"
            stroke={lineColor('right_forearm')}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

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
        x1="58"
        x2="284"
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />

      <text
        x="294"
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
