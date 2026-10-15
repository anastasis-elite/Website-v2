'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import { AOSChip } from '@/components/aos-ui/AOSChip'
import { AOSSectionHeader } from '@/components/aos-ui/AOSSectionHeader'
import { AOSSlider } from '@/components/aos-ui/AOSSlider'

const options = ['Full rest', 'Gentle walk', 'Mobility', 'Breathwork', 'Meditation', 'Warm soak']

export default function RecoveryLogger({ clientId }: { clientId: string }) {
  const router=useRouter()
  const [selected, setSelected] = useState('')
  const [minutes, setMinutes] = useState(20)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const completionHintId = useId()

  async function save() {
    if (!selected || saving) return
    setSaving(true);setError('')
    try {
      const response=await fetch('/api/recovery/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,activityType:selected,minutes})})
      const payload=await response.json().catch(() => null)
      if(!response.ok) throw new Error(payload?.error||'Recovery could not be saved.')
      setSaved(true);router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Recovery could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AOSCard className="aos-recovery-logger">
      <AOSSectionHeader eyebrow="Log Recovery" title="What can your body receive?" copy="Choose one action. Completing the right-sized action counts toward today." />
      <div className="aos-chip-list">
        {options.map((option) => (
          <AOSChip key={option} selected={selected === option} onClick={() => { setSelected(option); setSaved(false) }}>{option}</AOSChip>
        ))}
      </div>
      {selected && selected !== 'Full rest' ? (
        <AOSSlider label="Duration" value={minutes} min={5} max={90} step={5} suffix=" minutes" onChange={(value)=>{setMinutes(value);setSaved(false)}}/>
      ) : null}
      <AOSButton type="button" disabled={!selected||saving} aria-describedby={!selected ? completionHintId : undefined} onClick={save}>{saving?'Saving…':'Complete Recovery Action'}</AOSButton>
      {!selected ? <p id={completionHintId} className="aos-status">Choose a recovery action above to enable completion.</p> : null}
      {saved ? <p className="aos-status">Recovery saved for today.</p> : null}
      {error ? <p className="aos-status" role="alert">{error}</p> : null}
    </AOSCard>
  )
}
