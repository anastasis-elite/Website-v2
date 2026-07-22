import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

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

      Alert.alert('Connected', 'The mobile app signed into Supabase.')
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
        <Text style={styles.brand}>ANASTASIS</Text>

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
          style={styles.input}
          value={email}
        />

        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable
          disabled={loading}
          onPress={handleLogin}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f4ef',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: {
    marginBottom: 32,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  heading: {
    marginBottom: 8,
    fontSize: 34,
    fontWeight: '700',
  },
  subheading: {
    marginBottom: 32,
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    height: 54,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  button: {
    minHeight: 54,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#151515',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
})
