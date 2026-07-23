import { router } from 'expo-router'
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { supabase } from '../lib/supabase'

export default function TodayScreen() {
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.brand}>ANASTASIS</Text>
        <Text style={styles.heading}>Today</Text>
        <Text style={styles.body}>
          Your mobile connection is working.
        </Text>

        <Pressable onPress={handleSignOut} style={styles.button}>
          <Text style={styles.buttonText}>Sign out</Text>
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
    padding: 24,
  },
  brand: {
    marginTop: 20,
    marginBottom: 40,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  heading: {
    marginBottom: 10,
    fontSize: 36,
    fontWeight: '700',
  },
  body: {
    fontSize: 17,
    lineHeight: 25,
  },
  button: {
    minHeight: 52,
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#151515',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
})
