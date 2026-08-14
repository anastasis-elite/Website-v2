import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { observeNotificationNavigation } from '../lib/notifications'

export default function RootLayout() {
  useEffect(() => {
    const subscription = observeNotificationNavigation()

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
