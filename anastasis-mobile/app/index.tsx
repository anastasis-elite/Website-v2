import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { supabase } from '../lib/supabase'

export default function IndexScreen() {
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let active = true

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (active) {
        setSignedIn(Boolean(session))
        setLoading(false)
      }
    }

    checkSession()

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    )
  }

  return <Redirect href={signedIn ? '/today' : '/login'} />
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
