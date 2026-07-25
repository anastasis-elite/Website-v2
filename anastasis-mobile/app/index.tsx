import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native'

import { supabase } from '../lib/supabase'

type Destination = '/login' | '/today' | null

export default function IndexScreen() {
  const [destination, setDestination] = useState<Destination>(null)

  useEffect(() => {
    let mounted = true

    async function restoreSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setDestination(session ? '/today' : '/login')
    }

    restoreSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      setDestination(session ? '/today' : '/login')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (!destination) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  return <Redirect href={destination} />
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070707',
  },
})
