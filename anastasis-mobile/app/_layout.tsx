import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import { maybeSyncHealthOnForeground } from '../lib/health/foregroundSync'
import { observeNotificationNavigation } from '../lib/notifications'

export default function RootLayout() {
  useEffect(() => {
    const subscription = observeNotificationNavigation()

    return () => {
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        maybeSyncHealthOnForeground().catch(() => undefined)
      }
    })

    return () => {
      subscription.remove()
    }
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </>
  )
}
