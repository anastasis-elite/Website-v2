'use client'

import { useState } from 'react'

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

export default function CycleFlowLogger({ clientId }: Props) {
  const [products, setProducts] = useState<FlowProduct[]>([emptyProduct()])
  const [energy, setEnergy] = useState(5)
  const [fatigue, setFatigue] = useState(5)
  const [perceivedRecovery, setPerceivedRecovery] = useState(5)
  const [trainingReadiness, setTrainingReadiness] = useState(5)
  const [symptoms, setSymptoms] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [flowBand, setFlowBand] = useState<string | null>(null)
  const [followUpMessage, setFollowUpMessage] = useState<string | null>(null)

  function updateProduct(index: number, patch: Partial<FlowProduct>) {
    setProducts((previous) =>
      previous.map((product, currentIndex) =>
        currentIndex === index ? { ...product, ...patch } : product,
      ),
    )
  }

  async function saveFlow() {
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
          energy,
          fatigue,
          perceivedRecovery,
          trainingReadiness,
          symptoms,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'Flow log could not be saved.')
      }

      setFlowBand(data?.burden?.burdenBand || null)
      setFollowUpMessage(data?.escalation?.message || null)
      setMessage('Flow log saved.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Flow log could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={styles.cartBoxStyle}>
      <h2 style={styles.sectionTitleStyle}>Today’s Flow</h2>

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
                    value={product.quantity}
                    onChange={(event) => updateProduct(index, { quantity: Number(event.target.value || 1) })}
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
                value={symptoms[key] || 'none'}
                onChange={(event) => setSymptoms((previous) => ({ ...previous, [key]: event.target.value }))}
                style={styles.inputStyle}
              >
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
        disabled={saving}
        style={{ ...styles.primaryButtonStyle, marginTop: '22px', opacity: saving ? 0.65 : 1 }}
      >
        {saving ? 'Saving...' : 'Save Flow'}
      </button>

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
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.labelStyle}>
        {label}: {value}
      </span>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ accentColor: '#b56e43' }}
      />
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
