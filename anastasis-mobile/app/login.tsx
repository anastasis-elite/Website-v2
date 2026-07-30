import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import { colors } from '../lib/theme'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (mounted && session) {
        router.replace('/today')
      }
    }

    checkExistingSession()

    return () => {
      mounted = false
    }
  }, [])

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      Alert.alert('Missing information', 'Enter your email and password.')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        Alert.alert('Unable to sign in', error.message)
        return
      }

      router.replace('/today')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred.'

      Alert.alert('Unable to sign in', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.flame}>🔥</Text>
          <View>
            <Text style={styles.brandText}>ANASTASIS</Text>
            <Text style={styles.brandSub}>Client Platform</Text>
          </View>
        </View>

        <AOSCard>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>
            Sign in to continue your daily plan.
          </Text>

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.subtle}
            style={styles.input}
            value={email}
          />

          <TextInput
            autoCapitalize="none"
            autoComplete="password"
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            placeholder="Password"
            placeholderTextColor={colors.subtle}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <AOSButton disabled={loading} onPress={handleLogin}>
            {loading ? 'Signing in' : 'Sign in'}
          </AOSButton>
        </AOSCard>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  flame: {
    fontSize: 40,
  },
  brandText: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 2,
  },
  brandSub: {
    marginTop: 5,
    color: '#BA7258',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heading: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 32,
  },
  subheading: {
    marginTop: 10,
    marginBottom: 24,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    minHeight: 54,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    backgroundColor: colors.input,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 16,
  },
})
