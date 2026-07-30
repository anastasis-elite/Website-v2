import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

const actions = [
  {
    title: 'Daily Check-In',
    body: 'Sleep, energy, stress, soreness, mood, hunger, cycle, and symptoms.',
    href: '/check-in',
    primary: true,
  },
  {
    title: 'Monthly Assessment',
    body: 'Refresh current body, strength, recovery, goals, and readiness.',
    href: '/progress',
    primary: true,
  },
  {
    title: 'Measurements',
    body: 'Record consistent physical measurements for trend clarity.',
    href: '/progress',
    primary: false,
  },
  {
    title: 'Photos',
    body: 'Private progress photos and assessment references.',
    href: '/progress',
    primary: false,
  },
]

export default function AssessmentsScreen() {
  const data = mockDashboard

  return (
    <AppShell active="assessments">
      <SectionHeader
        eyebrow="Assessments"
        title="Use the right check-in for the right job."
        copy="Daily signals guide today. Monthly and strength assessments update the longer plan."
      />

      <View style={styles.summaryGrid}>
        <AOSCard>
          <Text style={styles.eyebrow}>Due now</Text>
          <Text style={styles.big}>{data.assessment.dueCount}</Text>
          <Text style={styles.copy}>Complete only what is due.</Text>
        </AOSCard>
        <AOSCard>
          <Text style={styles.eyebrow}>Daily</Text>
          <Text style={styles.big}>
            {data.assessment.dailyComplete ? '✓' : '○'}
          </Text>
          <Text style={styles.copy}>
            {data.assessment.dailyComplete ? 'Complete' : 'Open today'}
          </Text>
        </AOSCard>
      </View>

      <AOSCard>
        <Text style={styles.eyebrow}>Available Assessments</Text>
        <View style={styles.list}>
          {actions.map((action) => (
            <Pressable
              key={action.title}
              onPress={() => router.push(action.href as never)}
              style={({ pressed }) => [
                styles.row,
                action.primary && styles.primaryRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{action.title}</Text>
                <Text style={styles.rowBody}>{action.body}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </AOSCard>

      <StateBanner
        state="complete"
        title="Completed state preview"
        message="Completed monthly items will remain visible but out of the required flow once live assessment status is connected."
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  eyebrow: {
    color: '#E0B29D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  big: {
    marginTop: 8,
    color: colors.copper,
    fontFamily: 'Georgia',
    fontSize: 46,
  },
  copy: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    gap: 10,
    marginTop: 16,
  },
  row: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 14,
  },
  primaryRow: {
    borderColor: 'rgba(225,94,45,0.28)',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  rowBody: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  chevron: {
    color: colors.copper,
    fontSize: 24,
  },
  pressed: {
    opacity: 0.72,
  },
})
