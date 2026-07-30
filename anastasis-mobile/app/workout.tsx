import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function WorkoutScreen() {
  const data = mockDashboard
  const completed = data.workout.exercises.filter(
    (exercise) => exercise.complete
  ).length

  return (
    <AppShell active="workout">
      <SectionHeader
        eyebrow={`${data.client.program} · Today's Workout`}
        title={data.workout.title}
        copy={`${data.workout.intensityTarget}. ${data.workout.adjustment}`}
      />

      <AOSCard>
        <Text style={styles.eyebrow}>Fuel first</Text>
        <Text style={styles.title}>Ready to train</Text>
        <Text style={styles.copy}>{data.workout.fuelPrompt}</Text>
      </AOSCard>

      <AOSCard>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.eyebrow}>Workout Execution</Text>
            <Text style={styles.title}>
              {completed}/{data.workout.exercises.length} complete
            </Text>
          </View>
          <Text style={styles.duration}>{data.workout.durationMinutes}m</Text>
        </View>

        <View style={styles.exerciseList}>
          {data.workout.exercises.map((exercise, index) => (
            <Pressable
              key={exercise.id}
              onPress={() => router.push('/workout-execution')}
              style={({ pressed }) => [
                styles.exercise,
                exercise.complete && styles.exerciseComplete,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.exerciseIndex}>{index + 1}</Text>
              <View style={styles.exerciseCopy}>
                <Text style={styles.exerciseTitle}>{exercise.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {exercise.prescription}
                </Text>
              </View>
              <Text style={styles.status}>
                {exercise.complete ? '✓' : '○'}
              </Text>
            </Pressable>
          ))}
        </View>

        <AOSButton onPress={() => router.push('/workout-execution')}>
          Start Workout
        </AOSButton>
      </AOSCard>

      <StateBanner
        state={data.workout.complete ? 'complete' : 'loading'}
        title={
          data.workout.complete ? 'Workout complete' : 'Execution is mocked'
        }
        message="Phase 1 presents the workout flow with temporary exercise data. Live workout assignment and log saving stay in Phase 2."
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
    fontSize: 23,
  },
  copy: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  duration: {
    color: colors.copper,
    fontSize: 24,
    fontWeight: '800',
  },
  exerciseList: {
    gap: 10,
    marginVertical: 18,
  },
  exercise: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 14,
  },
  exerciseComplete: {
    borderColor: 'rgba(124,169,95,0.26)',
  },
  exerciseIndex: {
    width: 32,
    height: 32,
    borderRadius: 999,
    color: colors.copper,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 32,
    textAlign: 'center',
    backgroundColor: colors.copperSoft,
  },
  exerciseCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
  },
  status: {
    color: colors.copper,
    fontSize: 20,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
})
