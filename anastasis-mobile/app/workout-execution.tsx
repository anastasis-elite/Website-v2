import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function WorkoutExecutionScreen() {
  const [completed, setCompleted] = useState(
    new Set(
      mockDashboard.workout.exercises
        .filter((exercise) => exercise.complete)
        .map((exercise) => exercise.id)
    )
  )

  const allComplete =
    completed.size === mockDashboard.workout.exercises.length

  function toggle(id: string) {
    setCompleted((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AppShell active="workout">
      <SectionHeader
        eyebrow="Workout Execution"
        title={mockDashboard.workout.title}
        copy="Tap each exercise to preview the completion state. This does not save a workout log yet."
      />

      {allComplete ? (
        <StateBanner
          state="complete"
          title="Workout complete"
          message="Completion is local for Phase 1. Workout log persistence remains Phase 2."
        />
      ) : null}

      <AOSCard>
        <View style={styles.list}>
          {mockDashboard.workout.exercises.map((exercise) => {
            const done = completed.has(exercise.id)

            return (
              <Pressable
                key={exercise.id}
                onPress={() => toggle(exercise.id)}
                style={[styles.exercise, done && styles.done]}
              >
                <View style={styles.exerciseHead}>
                  <Text style={styles.exerciseTitle}>{exercise.name}</Text>
                  <Text style={styles.status}>{done ? '✓' : '○'}</Text>
                </View>
                <Text style={styles.meta}>{exercise.prescription}</Text>
                <View style={styles.cueList}>
                  {exercise.cues.map((cue) => (
                    <Text key={cue} style={styles.cue}>
                      {cue}
                    </Text>
                  ))}
                </View>
              </Pressable>
            )
          })}
        </View>
        <AOSButton disabled={!allComplete}>
          {allComplete ? 'Finish Workout' : 'Complete All Exercises'}
        </AOSButton>
      </AOSCard>
    </AppShell>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    marginBottom: 18,
  },
  exercise: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 15,
  },
  done: {
    borderColor: 'rgba(124,169,95,0.32)',
  },
  exerciseHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  exerciseTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  status: {
    color: colors.copper,
    fontSize: 22,
  },
  meta: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 13,
  },
  cueList: {
    gap: 7,
    marginTop: 14,
  },
  cue: {
    borderLeftWidth: 2,
    borderLeftColor: colors.copper,
    color: '#D8C6BA',
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 10,
  },
})
