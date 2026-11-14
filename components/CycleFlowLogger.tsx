'use client'

import { useRef, useState } from 'react'
import { localDateKey } from '@/lib/timezone'
import Link from 'next/link'

import * as styles from '@/app/styles/globalstyles'

type ProductType = 'tampon' | 'pad' | 'cup' | 'disc' | 'period_underwear' | 'other'

type FlowProduct = {
  productType: ProductType
  absorbency: string
  quantity: number
  saturation: string
  estimatedMl: string
  empties: string
  capacityMl: string
  fullness: string
  changeIntervalHours: string
  leakOrOverflow: boolean
  customLabel: string
}

type Props = {
  clientId: string
  localDate?: string
  timeZone?: string
  onSaved?: () => void
  onSavingChange?: (saving: boolean) => void
}

const productTypes: Array<{ value: ProductType; label: string }> = [
  { value: 'tampon', label: 'Tampon' },
  { value: 'pad', label: 'Pad' },
  { value: 'cup', label: 'Cup' },
  { value: 'disc', label: 'Disc' },
  { value: 'period_underwear', label: 'Underwear' },
  { value: 'other', label: 'Other' },
]

const absorbenciesByType: Record<ProductType, string[]> = {
  tampon: ['light', 'regular', 'super', 'super_plus', 'ultra'],
  pad: ['light', 'regular', 'heavy', 'overnight'],
  cup: [],
  disc: [],
  period_underwear: ['light', 'moderate', 'heavy', 'overnight'],
  other: ['custom'],
}

const saturationOptions = ['25', '50', '75', '100', 'overflow']
const severityOptions = ['none', 'mild', 'moderate', 'severe']
const symptomKeys = [
  'dizziness',
  'weakness',
  'shortness_of_breath',
  'headache',
  'migraine',
  'cramping',
  'pelvic_pain',
  'back_pain',
  'nausea',
  'bloating',
  'bowel_changes',
  'appetite',
  'cravings',
  'mood',
  'sleep_quality',
]

function emptyProduct(): FlowProduct {
  return {
    productType: 'tampon',
    absorbency: 'regular',
    quantity: 1,
    saturation: '75',
    estimatedMl: '',
    empties: '',
    capacityMl: '',
    fullness: '',
    changeIntervalHours: '',
    leakOrOverflow: false,
    customLabel: '',
  }
}

function labelFor(value: string) {
  return value.replaceAll('_', ' ')
}

export default function CycleFlowLogger({ clientId, localDate, timeZone, onSaved, onSavingChange }: Props) {
  const [products, setProducts] = useState<FlowProduct[]>([])
  const [energy, setEnergy] = useState<number | null>(null)
  const [fatigue, setFatigue] = useState<number | null>(null)
  const [perceivedRecovery, setPerceivedRecovery] = useState<number | null>(null)
  const [trainingReadiness, setTrainingReadiness] = useState<number | null>(null)
  const [symptoms, setSymptoms] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [flowBand, setFlowBand] = useState<string | null>(null)
  const [followUpMessage, setFollowUpMessage] = useState<string | null>(null)
  const saveLock = useRef(false)
  const confirmedSave = useRef(false)
  const uncertainSave = useRef(false)
  const [saved, setSaved] = useState(false)
  const [uncertain, setUncertain] = useState(false)

  function newEntry() {
    if (saveLock.current) return
    confirmedSave.current = false
    setSaved(false)
    uncertainSave.current = false
    setUncertain(false)
    setProducts([])
    setEnergy(null)
    setFatigue(null)
    setPerceivedRecovery(null)
    setTrainingReadiness(null)
    setSymptoms({})
    setMessage('')
    setError('')
    setFlowBand(null)
    setFollowUpMessage(null)
  }

  function updateProduct(index: number, patch: Partial<FlowProduct>) {
    setProducts((previous) =>
      previous.map((product, currentIndex) =>
        currentIndex === index ? { ...product, ...patch } : product,
      ),
    )
  }

  async function saveFlow() {
    if (saveLock.current || confirmedSave.current || uncertainSave.current) return
    if (!products.length) { setError('Add the products you used before saving flow. Period end is recorded in your Daily Check-In.'); return }
    if (localDate && timeZone && localDateKey(new Date(), timeZone) !== localDate) {
      setError('A new day has started. Open Today before logging flow.'); return
    }
    saveLock.current = true
    onSavingChange?.(true)
    let rejectedBeforeWrite = false
    try {
      setSaving(true)
      setError('')
      setMessage('')
      setFollowUpMessage(null)

      const response = await fetch('/api/cycle/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          ...(localDate ? { logDate: localDate } : {}),
          products: products.map((product) => ({
            productType: product.productType,
            absorbency: product.absorbency || null,
            quantity: product.quantity,
            saturation: product.saturation || null,
            estimatedMl: product.estimatedMl ? Number(product.estimatedMl) : null,
            empties: product.empties ? Number(product.empties) : null,
            capacityMl: product.capacityMl ? Number(product.capacityMl) : null,
            fullness: product.fullness || null,
            changeIntervalHours: product.changeIntervalHours ? Number(product.changeIntervalHours) : null,
            leakOrOverflow: product.leakOrOverflow,
            customLabel: product.customLabel || null,
          })),
          ...(energy === null ? {} : { energy }),
          ...(fatigue === null ? {} : { fatigue }),
          ...(perceivedRecovery === null ? {} : { perceivedRecovery }),
          ...(trainingReadiness === null ? {} : { trainingReadiness }),
          symptoms,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok || data?.success !== true) {
        // The existing endpoint writes several records. A failed response may
        // arrive after a flow record was inserted, so never blindly resubmit.
        rejectedBeforeWrite = [400, 401, 403, 404, 409, 422].includes(response.status)
        throw new Error(data?.error || 'Flow log could not be confirmed.')
      }

      setFlowBand(data?.burden?.burdenBand || null)
      setFollowUpMessage(data?.escalation?.message || null)
      confirmedSave.current = true
      setSaved(true)
      setMessage('Flow log saved separately. Continue your Daily Check-In and save your answers when ready.')
      onSaved?.()
    } catch (caughtError) {
      if (!rejectedBeforeWrite && !confirmedSave.current) { uncertainSave.current = true; setUncertain(true) }
      setError(caughtError instanceof Error ? caughtError.message : 'Flow log could not be saved.')
    } finally {
      saveLock.current = false
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <section style={styles.cartBoxStyle}>
      <h2 style={styles.sectionTitleStyle}>Today’s Flow</h2>
      <p style={styles.bodyStyle}>Save Flow adds a new flow entry separately from your Daily Check-In. Add only products you used; optional ratings stay unanswered until you choose them.</p>
      <fieldset disabled={saving || saved || uncertain} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>

      <div style={{ display: 'grid', gap: '18px', marginTop: '18px' }}>
        {products.map((product, index) => {
          const isVolumeProduct = product.productType === 'cup' || product.productType === 'disc'
          const absorbencies = absorbenciesByType[product.productType]

          return (
            <div
              key={index}
              style={{
                borderRadius: '20px',
                padding: '16px',
                background: 'rgba(255,255,255,0.018)',
              }}
            >
              <div style={styles.gridTwoCol}>
                <div style={styles.fieldWrap}>
                  <label style={styles.labelStyle}>Product</label>
                  <select
                    value={product.productType}
                    onChange={(event) => {
                      const productType = event.target.value as ProductType
                      updateProduct(index, {
                        productType,
                        absorbency: absorbenciesByType[productType][0] || '',
                      })
                    }}
                    style={styles.inputStyle}
                  >
                    {productTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {absorbencies.length ? (
                  <div style={styles.fieldWrap}>
                    <label style={styles.labelStyle}>Absorbency</label>
                    <select
                      value={product.absorbency}
                      onChange={(event) => updateProduct(index, { absorbency: event.target.value })}
                      style={styles.inputStyle}
                    >
                      {absorbencies.map((option) => (
                        <option key={option} value={option}>
                          {labelFor(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div style={{ ...styles.gridTwoCol, marginTop: '14px' }}>
                <div style={styles.fieldWrap}>
                  <label style={styles.labelStyle}>{isVolumeProduct ? 'Empties' : 'Quantity'}</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={isVolumeProduct ? product.empties : product.quantity}
                    onChange={(event) => updateProduct(index, isVolumeProduct ? { empties: event.target.value } : { quantity: Number(event.target.value || 1) })}
                    placeholder={isVolumeProduct ? 'Number of empties' : undefined}
                    style={styles.inputStyle}
                  />
                </div>

                {isVolumeProduct ? (
                  <div style={styles.fieldWrap}>
                    <label style={styles.labelStyle}>Estimated mL</label>
                    <input
                      type="number"
                      min={0}
                      value={product.estimatedMl}
                      onChange={(event) => updateProduct(index, { estimatedMl: event.target.value })}
                      style={styles.inputStyle}
                      placeholder="Optional"
                    />
                  </div>
                ) : (
                  <div style={styles.fieldWrap}>
                    <label style={styles.labelStyle}>Saturation</label>
                    <select
                      value={product.saturation}
                      onChange={(event) => updateProduct(index, { saturation: event.target.value })}
                      style={styles.inputStyle}
                    >
                      {saturationOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'overflow' ? 'Overflow / leak' : `${option}%`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {isVolumeProduct ? (
                <div style={{ ...styles.gridTwoCol, marginTop: '14px' }}>
                  <div style={styles.fieldWrap}>
                    <label style={styles.labelStyle}>Cup capacity mL</label>
                    <input
                      type="number"
                      min={0}
                      value={product.capacityMl}
                      onChange={(event) => updateProduct(index, { capacityMl: event.target.value })}
                      style={styles.inputStyle}
                      placeholder="Optional"
                    />
                  </div>

                  <div style={styles.fieldWrap}>
                    <label style={styles.labelStyle}>Fullness</label>
                    <select
                      value={product.fullness}
                      onChange={(event) => updateProduct(index, { fullness: event.target.value })}
                      style={styles.inputStyle}
                    >
                      <option value="">Unknown</option>
                      {saturationOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'overflow' ? 'Overflow / leak' : `${option}%`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <div style={{ ...styles.gridTwoCol, marginTop: '14px' }}>
                <div style={styles.fieldWrap}>
                  <label style={styles.labelStyle}>Hours between changes</label>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={product.changeIntervalHours}
                    onChange={(event) => updateProduct(index, { changeIntervalHours: event.target.value })}
                    style={styles.inputStyle}
                    placeholder="Optional"
                  />
                </div>

                {product.productType === 'other' ? (
                  <div style={styles.fieldWrap}>
                    <label style={styles.labelStyle}>Custom product</label>
                    <input
                      value={product.customLabel}
                      onChange={(event) => updateProduct(index, { customLabel: event.target.value })}
                      style={styles.inputStyle}
                      placeholder="Optional"
                    />
                  </div>
                ) : (
                  <CycleInlineCheckbox
                    label="Leak or overflow"
                    checked={product.leakOrOverflow}
                    onChange={(checked) => updateProduct(index, { leakOrOverflow: checked })}
                  />
                )}
              </div>
              <button type="button" onClick={() => setProducts(previous => previous.filter((_, currentIndex) => currentIndex !== index))} style={{ ...styles.secondaryButtonStyle, marginTop: '14px' }}>Remove product {index + 1}</button>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => setProducts((previous) => [...previous, emptyProduct()])}
          style={styles.secondaryButtonStyle}
        >
          Add Product
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(181,110,67,0.14)', paddingTop: '22px', marginTop: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#f5f0e8', fontSize: '1.1rem', fontWeight: 500 }}>
          How are you feeling today?
        </h3>

        <div style={styles.gridTwoCol}>
          <ScaleInput label="Energy" value={energy} onChange={setEnergy} />
          <ScaleInput label="Fatigue" value={fatigue} onChange={setFatigue} />
          <ScaleInput label="Perceived recovery" value={perceivedRecovery} onChange={setPerceivedRecovery} />
          <ScaleInput label="Training readiness" value={trainingReadiness} onChange={setTrainingReadiness} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '18px' }}>
          {symptomKeys.map((key) => (
            <label key={key} style={styles.fieldWrap}>
              <span style={styles.labelStyle}>{labelFor(key)}</span>
              <select
                value={symptoms[key] || ''}
                onChange={(event) => setSymptoms((previous) => ({ ...previous, [key]: event.target.value }))}
                style={styles.inputStyle}
              >
                <option value="">Not answered</option>
                {severityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={saveFlow}
        disabled={saving || saved || uncertain || !products.length}
        style={{ ...styles.primaryButtonStyle, marginTop: '22px', opacity: saving ? 0.65 : 1 }}
      >
        {saving ? 'Saving...' : saved ? 'Flow saved' : 'Save Flow'}
      </button>

      </fieldset>
      {saved ? <button type="button" onClick={newEntry} style={{ ...styles.secondaryButtonStyle, marginTop: '14px' }}>Log another entry</button> : null}
      {uncertain ? <p role="alert" style={styles.bodyStyle}>The save could not be confirmed and may already be recorded. Review your Cycle history before logging another entry; this entry cannot be submitted again here. <Link href="/dashboard/cycle">Open Cycle</Link></p> : null}

      {flowBand ? (
        <p style={{ ...styles.bodyStyle, marginTop: '14px' }}>
          Daily flow indicator: <strong>{labelFor(flowBand)}</strong>
        </p>
      ) : null}

      {followUpMessage ? <p style={{ ...styles.bodyStyle, marginTop: '12px' }}>{followUpMessage}</p> : null}
      {message ? <p style={{ ...styles.bodyStyle, marginTop: '12px' }}>{message}</p> : null}
      {error ? <p style={{ ...styles.bodyStyle, marginTop: '12px', color: '#ffb4b4' }}>{error}</p> : null}
    </section>
  )
}

function ScaleInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (value: number) => void
}) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.labelStyle}>
        {label}: {value === null ? 'not answered' : value}
      </span>
      <input
        type="range"
        min={1}
        max={10}
        value={value ?? 5}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ accentColor: '#b56e43' }}
      />
      {value === null ? <button type="button" onClick={() => onChange(5)} style={styles.secondaryButtonStyle}>Use 5 for {label.toLowerCase()}</button> : null}
    </label>
  )
}

function CycleInlineCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      style={{
        ...styles.bodyStyle,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginTop: '28px',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ accentColor: '#b56e43' }}
      />
      {label}
    </label>
  )
}
