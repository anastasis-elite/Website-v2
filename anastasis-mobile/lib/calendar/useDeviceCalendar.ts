import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { observeDeviceCalendar, readDeviceCalendars, type DeviceSnapshot } from './device'
import { supabase } from '../supabase'

export function useDeviceCalendar(date = new Date()) {
  const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const invalidate = useCallback(() => { generation.current++ }, [])
  const refresh = useCallback(async () => {
    const request = ++generation.current
    try {
      const start = new Date(date); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + 1)
      const result = await readDeviceCalendars(start, end)
      if (request !== generation.current) return
      setSnapshot(result); setError(result.error)
    } catch (failure) {
      if (request !== generation.current) return
      setSnapshot(null); setError(failure instanceof Error ? failure.message : 'Calendar unavailable.')
    } finally { if (request === generation.current) setLoading(false) }
    // Stable per-day query avoids resubscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])
  useFocusEffect(useCallback(() => { void refresh(); return invalidate }, [refresh, invalidate]))
  useEffect(() => {
    const remove = observeDeviceCalendar(() => { void refresh() })
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh() })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      invalidate(); setSnapshot(null); void refresh()
    })
    return () => { invalidate(); remove(); app.remove(); subscription.unsubscribe() }
  }, [refresh, invalidate])
  return { snapshot, loading, error, refresh }
}
