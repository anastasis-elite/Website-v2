import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import type { PlanBlock } from '../lib/mockData'
import AOSButton from './AOSButton'
import AOSCard from './AOSCard'
import AppShell from './AppShell'
import SectionHeader from './SectionHeader'
import StateBanner from './StateBanner'
import { colors } from '../lib/theme'

type Props = {
  block: PlanBlock
}

export default function DayBlockScreen({ block }: Props) {
  return (
    <AppShell active="today">
      <SectionHeader
        eyebrow="Today's Intake"
        title={block.title}
        copy={block.body}
      />

      <AOSCard>
        <Text style={styles.eyebrow}>{block.timing}</Text>
        <Text style={styles.title}>Your focus for this block</Text>
        <Text style={styles.copy}>{block.focus}</Text>

        <View style={styles.list}>
          {block.tasks.map((task) => (
            <View
              key={task.id}
              style={[styles.task, task.complete && styles.complete]}
            >
              <Text style={styles.status}>{task.complete ? '✓' : '○'}</Text>
              <View style={styles.taskCopy}>
                <Text style={styles.taskTitle}>{task.label}</Text>
                <Text style={styles.copy}>{task.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {block.id === 'midday' ? (
          <AOSButton onPress={() => router.push('/workout')}>
            Open Workout
          </AOSButton>
        ) : (
          <AOSButton
            variant="secondary"
            onPress={() => router.push('/check-in')}
          >
            Open Check-In
          </AOSButton>
        )}
      </AOSCard>

      <StateBanner
        state="loading"
        title="Block saving pending"
        message="This Phase 1 detail screen mirrors the web day-block structure. Task completion persistence is not connected yet."
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
  },
  copy: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    gap: 10,
    marginVertical: 18,
  },
  task: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 14,
  },
  complete: {
    borderColor: 'rgba(124,169,95,0.30)',
  },
  status: {
    color: colors.copper,
    fontSize: 18,
    fontWeight: '800',
  },
  taskCopy: {
    flex: 1,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
})
