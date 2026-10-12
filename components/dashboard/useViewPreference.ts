'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { readViewPreference, viewPreferenceKey, writeViewPreference } from '@/lib/dashboard/viewPreferences'

export function useViewPreference<T extends string>(
  clientId: string,
  view: string,
  allowedValues: readonly T[],
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const key = viewPreferenceKey(clientId, view)
  const [value, setValue] = useState<T>(fallback)
  const [restoredKey, setRestoredKey] = useState<string | null>(null)
  const allowedKey = allowedValues.join('\u0000')

  useEffect(() => {
    let restored = fallback
    try {
      restored = readViewPreference(window.localStorage, key, allowedKey.split('\u0000') as T[], fallback)
    } catch {
      // Accessing localStorage itself can throw in a restricted browser.
    }
    setValue(restored)
    setRestoredKey(key)
  }, [key, allowedKey, fallback])

  useEffect(() => {
    if (!clientId || restoredKey !== key) return
    try {
      writeViewPreference(window.localStorage, key, value)
    } catch {
      // Keep the current view usable without browser persistence.
    }
  }, [clientId, key, restoredKey, value])

  return [value, setValue]
}
