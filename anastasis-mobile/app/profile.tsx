import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import MetricCard from '../components/MetricCard'
import SectionHeader from '../components/SectionHeader'
import { mockDashboard } from '../lib/mockData'
import { scheduleTestConciergeNotification } from '../lib/notifications'
import { colors } from '../lib/theme'
import { supabase } from '../lib/supabase'

const rows = [
  ['Health & Wearables', '/health'],
  ['Assessments', '/assessments'],
  ['Progress History', '/progress'],
  ['Daily Check-In', '/check-in'],
  ['Cycle Awareness', '/cycle'],
  ['Help & Support', 'mailto:Anastasis.elite@gmail.com'],
]

export default function ProfileScreen() {
  const [email, setEmail] = useState(mockDashboard.client.email)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/login')
  }

  async function testNotification() {
    try {
      await scheduleTestConciergeNotification()
      Alert.alert('Notification scheduled', 'A test prompt will arrive shortly.')
    } catch (error) {
      Alert.alert(
        'Notification unavailable',
        error instanceof Error
          ? error.message
          : 'Unable to schedule a notification.',
      )
    }
  }

  return (
    <AppShell active="profile">
      <SectionHeader
        eyebrow="Account"
        title={`${mockDashboard.client.name} ${mockDashboard.flame.icon}`}
        copy={`${mockDashboard.client.program} program · ${email}`}
      />

      <View style={styles.metricGrid}>
        <MetricCard
          icon="🔥"
          label="Streak"
          value={`${mockDashboard.flame.streak}`}
          detail="days"
        />
        <MetricCard
          icon="◎"
          label="Goal"
          value={`${mockDashboard.progress.weeklyCompletion}%`}
          detail="this week"
        />
      </View>

      <AOSCard>
        <Text style={styles.eyebrow}>Quick Actions</Text>
        <View style={styles.list}>
          {rows.map(([label, href]) => (
            <AOSButton
              key={label}
              variant="secondary"
              onPress={() => {
                if (!href.startsWith('mailto:')) {
                  router.push(href as never)
                }
              }}
            >
              {label}
            </AOSButton>
          ))}
        </View>
      </AOSCard>

      <AOSCard muted>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.copy}>
          Personal info, security, notification, and billing controls are
          represented here visually. Live profile editing is Phase 2.
        </Text>
        <View style={styles.signOut}>
          <AOSButton variant="secondary" onPress={testNotification}>
            Test Notification
          </AOSButton>
        </View>
        <View style={styles.signOut}>
          <AOSButton variant="danger" onPress={signOut}>
            Log Out
          </AOSButton>
        </View>
      </AOSCard>
    </AppShell>
  )
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  eyebrow: {
    color: '#E0B29D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  list: {
    gap: 10,
    marginTop: 16,
  },
  copy: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  signOut: {
    marginTop: 18,
  },
})
