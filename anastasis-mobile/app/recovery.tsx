import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import MetricCard from '../components/MetricCard'
import ProgressBar from '../components/ProgressBar'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function RecoveryScreen() {
  const data = mockDashboard

  return (
    <AppShell active="recovery">
      <SectionHeader
        eyebrow="Recovery"
        title="Let today's signals choose the support."
        copy="Daily Check-In records how you feel. Recovery turns those signals into the next useful action."
      />

      <AOSCard>
        <Text style={styles.eyebrow}>Today's Recommendation</Text>
        <Text style={styles.title}>{data.recovery.status}</Text>
        <Text style={styles.copy}>{data.recovery.recommendation}</Text>
        <View style={styles.readiness}>
          <Text style={styles.readinessValue}>{data.recovery.readiness}%</Text>
          <View style={styles.readinessTrack}>
            <ProgressBar percent={data.recovery.readiness} />
          </View>
        </View>
      </AOSCard>

      <View style={styles.metricGrid}>
        <MetricCard
          icon="↟"
          label="Movement"
          value={data.workout.intensityTarget}
          detail="today's adjustment"
        />
        <MetricCard
          icon="☾"
          label="Sleep"
          value={
            data.sleep.logged && data.sleep.hours
              ? `${data.sleep.hours}h`
              : 'Open'
          }
          detail={
            data.sleep.quality ? `quality ${data.sleep.quality}/10` : 'not logged'
          }
        />
      </View>

      <AOSCard>
        <Text style={styles.eyebrow}>Nervous System</Text>
        <Text style={styles.title}>Breathing reset</Text>
        <Text style={styles.copy}>
          A short reset mirrors the Phoenix support action from the web platform.
        </Text>
        <View style={styles.buttonRow}>
          <AOSButton variant="secondary">Start Reset</AOSButton>
          <AOSButton
            variant="secondary"
            onPress={() => router.push('/check-in')}
          >
            Check In
          </AOSButton>
        </View>
      </AOSCard>

      <StateBanner
        state="empty"
        title="Recovery logger pending"
        message="This screen shows the saved, empty, and action states visually. Live recovery activity saving is a Phase 2 integration."
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: '#E0B29D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 24,
    textTransform: 'capitalize',
  },
  copy: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  readiness: {
    marginTop: 18,
  },
  readinessValue: {
    marginBottom: 8,
    color: colors.copper,
    fontSize: 24,
    fontWeight: '800',
  },
  readinessTrack: {
    flex: 1,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
})
