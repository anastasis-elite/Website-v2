'use client'

import { useState } from 'react'
import { parseStrengthSetInput } from '@/lib/workout/logging'

type Props = {
  set: { weight: number; reps: number; weight_unit?: string; set_number: number }
  increment: number
  loadLabel: string
  disabled: boolean
  bodyweight?: boolean
  onSave: (values: { weight: number; reps: number }) => void
}

export default function WorkoutSetEditor({ set, increment, loadLabel, disabled, bodyweight, onSave }: Props) {
  const [weight, setWeight] = useState(String(set.weight))
  const [reps, setReps] = useState(String(set.reps))
  const [message, setMessage] = useState('')

  function save() {
    const values = parseStrengthSetInput(bodyweight ? 0 : weight, reps)
    if (!values) { setMessage('Enter a nonnegative weight and a positive whole number of reps.'); return }
    setMessage('')
    onSave(values)
  }

  return <div className="manual-current-set workout-set-editor">
    <div className="activity-inputs">
      {!bodyweight ? <label>Set {set.set_number} weight ({set.weight_unit || 'lb'}, {loadLabel})
        <input type="number" inputMode="decimal" min="0" step={increment} value={weight} disabled={disabled} onChange={event => setWeight(event.target.value)} />
      </label> : <p>Bodyweight · no added load</p>}
      <label>Set {set.set_number} reps
        <input type="number" inputMode="numeric" min="1" step="1" value={reps} disabled={disabled} onChange={event => setReps(event.target.value)} />
      </label>
    </div>
    <button type="button" disabled={disabled} onClick={save}>Update set {set.set_number}</button>
    {message ? <p role="status">{message}</p> : null}
  </div>
}
