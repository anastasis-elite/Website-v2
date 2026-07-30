import { StyleSheet, Text, View } from 'react-native'

import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function CycleScreen() {
  const cycle = mockDashboard.cycle

  return (
    <AppShell active="recovery">
      <SectionHeader
        eyebrow="Cycle Awareness"
        title="Your body context for today."
        copy="This space is for awareness only. Symptoms stay the stronger signal."
      />

      <AOSCard>
        <Text style={styles.eyebrow}>
          {cycle.enabled ? `Cycle Day ${cycle.day}` : 'Not active'}
        </Text>
        <Text style={styles.title}>
          {cycle.enabled ? cycle.phase : 'Cycle tracking is not active yet.'}
        </Text>
        <Text style={styles.copy}>{cycle.recommendation}</Text>
      </AOSCard>

      <AOSCard muted>
        <Text style={styles.eyebrow}>Quick Log</Text>
        <View style={styles.chips}>
          {['Period started', 'Cramps', 'Low energy', 'Mood shift'].map(
            (item) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            )
          )}
        </View>
      </AOSCard>

      <StateBanner
        state="empty"
        title="Cycle logging is visual only"
        message="Phase 1 mirrors the quick-log surface. Live cycle updates remain a Phase 2 API integration."
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
    fontSize: 28,
    textTransform: 'capitalize',
  },
  copy: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.copperSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
})
