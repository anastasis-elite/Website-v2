export type ViewPreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function viewPreferenceKey(clientId: string, view: string) {
  return `aos:view:v1:${encodeURIComponent(clientId)}:${encodeURIComponent(view)}`
}

export function readViewPreference<T extends string>(
  storage: ViewPreferenceStorage,
  key: string,
  allowedValues: readonly T[],
  fallback: T,
): T {
  try {
    const saved = storage.getItem(key)
    return allowedValues.includes(saved as T) ? saved as T : fallback
  } catch {
    return fallback
  }
}

export function writeViewPreference(storage: ViewPreferenceStorage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Preferences are optional when the browser blocks storage.
  }
}
