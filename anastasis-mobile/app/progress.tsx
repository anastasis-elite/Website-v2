import { StyleSheet, Text, View } from 'react-native'

import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import MetricCard from '../components/MetricCard'
import ProgressBar from '../components/ProgressBar'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function ProgressScreen() {
  const progress = mockDashboard.progress

  return (
    <AppShell active="progress">
      <SectionHeader
        eyebrow="Progress History"
        title="Measure with clarity, not pressure."
        copy="Phase 1 mirrors the measurements, photos, and journey summary surfaces."
      />

      <View style={styles.metricGrid}>
        <MetricCard
          icon="◎"
          label="Weight"
          value={progress.weight ? `${progress.weight}` : '—'}
          detail="lbs"
        />
        <MetricCard
          icon="♢"
          label="Body Fat"
          value={progress.bodyFat ? `${progress.bodyFat}%` : '—'}
          detail="latest"
        />
      </View>

      <AOSCard>
        <Text style={styles.eyebrow}>This Week</Text>
        <Text style={styles.title}>{progress.weeklyCompletion}% average completion</Text>
        <ProgressBar percent={progress.weeklyCompletion} />
      </AOSCard>

      <AOSCard muted>
        <Text style={styles.eyebrow}>Photos</Text>
        <Text style={styles.title}>
          {progress.photosDue ? 'Photo update due' : 'Photos updated'}
        </Text>
        <View style={styles.photoGrid}>
          {['Front', 'Back', 'Left', 'Right'].map((label) => (
            <View key={label} style={styles.photoSlot}>
              <Text style={styles.photoText}>{label}</Text>
            </View>
          ))}
        </View>
      </AOSCard>

      <StateBanner
        state="empty"
        title="Private gallery pending"
        message="Signed progress photos are not loaded in Phase 1. This screen shows the gallery structure only."
      />
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
  title: {
    marginVertical: 12,
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 24,
    lineHeight: 30,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  photoSlot: {
    width: '47%',
    aspectRatio: 0.75,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    backgroundColor: colors.input,
  },
  photoText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})
