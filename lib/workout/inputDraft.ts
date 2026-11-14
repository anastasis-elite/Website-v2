/** Unconfirmed input is session data, never a performed set or a new prescription. */
export type WorkoutInputDraft = {
  version: 1
  session_key: string
  weight_unit: 'lb' | 'kg'
  weightEdited?: true
  weight?: number | null
  amountEdited?: true
  amount?: number | null
}

const fields = new Set(['version', 'session_key', 'weight_unit', 'weightEdited', 'weight', 'amountEdited', 'amount'])
const inputValue = (value: unknown): value is number | null => value === null ||
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/** Reject corrupt or foreign occurrence drafts instead of borrowing their values. */
export function readWorkoutInputDraft(value: any, sessionKey: string): WorkoutInputDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).some(key => !fields.has(key)) || value.version !== 1 ||
    typeof sessionKey !== 'string' || !sessionKey || value.session_key !== sessionKey ||
    !['lb', 'kg'].includes(value.weight_unit) ||
    value.weightEdited !== true && value.amountEdited !== true) return null
  for (const [marker, field] of [['weightEdited', 'weight'], ['amountEdited', 'amount']]) {
    if (value[marker] === true ? !inputValue(value[field]) : Object.hasOwn(value, marker) || Object.hasOwn(value, field)) return null
  }
  return { version: 1, session_key: sessionKey, weight_unit: value.weight_unit,
    ...(value.weightEdited === true ? { weightEdited: true, weight: value.weight } : {}),
    ...(value.amountEdited === true ? { amountEdited: true, amount: value.amount } : {}) }
}

/** Defaults are already in the issued prescription; only explicit edits travel here.
 * JSON null distinguishes a cleared input from an absent, untouched input. */
export function createWorkoutInputDraft(draft: any, sessionKey: string, unit: 'lb' | 'kg'): WorkoutInputDraft | null {
  if (draft?.weightEdited !== true && draft?.amountEdited !== true) return null
  const value = (input: unknown) => typeof input === 'number' && Number.isFinite(input) ? input : null
  const original = draft?.inputWeight && ['lb', 'kg'].includes(draft.inputWeight.unit) ? draft.inputWeight : null
  return { version: 1, session_key: sessionKey, weight_unit: original?.unit ?? unit,
    ...(draft.weightEdited === true ? { weightEdited: true, weight: value(original ? original.value : draft.weight) } : {}),
    ...(draft.amountEdited === true ? { amountEdited: true, amount: value(draft.amount) } : {}) }
}
