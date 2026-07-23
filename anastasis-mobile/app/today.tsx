import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { supabase } from '../lib/supabase'

type TodayAction = {
  title: string
  description: string
  route?: string
}

const actions = [
  {
    title: 'Workout',
    description: 'Open today’s training session.',
    route: '/workout',
  },
  {
    title: 'Nutrition',
    description: 'Log meals, food, and water.',
    route: '/nutrition',
  },
  {
    title: 'Recovery',
    description: 'Enter sleep, stress, soreness, and energy.',
    route: '/recovery',
  },
  {
    title: 'Cycle',
    description: 'Log your cycle status and symptoms.',
    route: '/cycle',
  },
  {
    title: 'Assessments',
    description: 'Complete anything currently due.',
    route: '/assessments',
  },
]

export default function TodayScreen() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return

      if (!session) {
        router.replace('/login')
        return
      }

      setEmail(session.user.email ?? null)
    }

    loadSession()

    return () => {
      active = false
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>ANASTASIS</Text>

          <Text style={styles.heading}>Today</Text>

          <Text style={styles.subheading}>
            Tell Anastasis what happened today. Your next plan will be built
            from what you enter.
          </Text>

          {email ? <Text style={styles.account}>{email}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DAILY INPUT</Text>

          {actions.map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.route as never)}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{action.title}</Text>

                <Text style={styles.cardDescription}>
                  {action.description}
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutPressed,
          ]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  brand: {
    marginBottom: 28,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#2C1C14',
  },
  heading: {
    marginBottom: 10,
    fontSize: 38,
    fontWeight: '700',
    color: '#171717',
  },
  subheading: {
    maxWidth: 520,
    fontSize: 16,
    lineHeight: 24,
    color: '#625C57',
  },
  account: {
    marginTop: 12,
    fontSize: 13,
    color: '#857B74',
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    marginBottom: 2,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: '#8B5A3C',
  },
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E4DDD6',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  cardPressed: {
    opacity: 0.72,
  },
  cardText: {
    flex: 1,
    paddingRight: 14,
  },
  cardTitle: {
    marginBottom: 4,
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1A17',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#706862',
  },
  chevron: {
    fontSize: 30,
    lineHeight: 30,
    color: '#9D765E',
  },
  signOutButton: {
    minHeight: 50,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#211B18',
  },
  signOutPressed: {
    opacity: 0.82,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
