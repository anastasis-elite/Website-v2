export function AOSSlider({ label, value, min, max, step = 1, suffix = '/10', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  const percentage = ((value - min) / Math.max(1, max - min)) * 100
  return <label className="aos-slider"><span><span>{label}</span><strong>{value}{suffix}</strong></span><input type="range" min={min} max={max} step={step} value={value} style={{ '--aos-range-progress': `${percentage}%` } as React.CSSProperties} onChange={(event) => onChange(Number(event.target.value))} /></label>
}
