import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import ProgressBar from '../components/ProgressBar'
import {
  addWater,
  completeRecoveryAction,
  getMobileDailyState,
  type MobileDailyAction,
  type MobileDailyState,
} from '../lib/dashboard'
import { colors } from '../lib/theme'

const icons: Record<MobileDailyAction['id'], string> = {
  water: '◈',
  nutrition: 'Ψ',
  'check-in': '✓',
  workout: '↟',
  recovery: '♡',
}

function programLabel(program: MobileDailyState['user']['program']) {
  if (program === 'ember') return 'Guide me'
  if (program === 'phoenix') return 'Manage the moving pieces'
  return 'Adapt with me'
}

function actionTone(status: MobileDailyAction['status']) {
  if (status === 'complete') return styles.actionComplete
  if (status === 'urgent') return styles.actionUrgent
  if (status === 'active') return styles.actionActive
  return null
}

function actionButtonLabel(action: MobileDailyAction) {
  if (action.status === 'complete') return 'Review'
  if (action.kind === 'quick' && action.id === 'water') return 'Add 8 oz'
  if (action.kind === 'quick' && action.id === 'recovery') return 'Log reset'
  return action.label
}

export default function TodayScreen() {
  const [state, setState] = useState<MobileDailyState | null>(null)
  const [loading, setLoading] = useState(true)
  const [workingAction, setWorkingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadState = useCallback(async () => {
    try {
      setError(null)
      const nextState = await getMobileDailyState()
      setState(nextState)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Today could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadState()
  }, [loadState])

  async function handleAction(action: MobileDailyAction) {
    if (action.kind === 'route' || action.status === 'complete') {
      router.push(action.href as never)
      return
    }

    try {
      setWorkingAction(action.id)

      if (action.id === 'water') {
        await addWater(8)
      }

      if (action.id === 'recovery') {
        await completeRecoveryAction()
      }

      await loadState()
    } catch (actionError) {
      Alert.alert(
        'Action unavailable',
        actionError instanceof Error
          ? actionError.message
          : 'The action could not be completed.',
      )
    } finally {
      setWorkingAction(null)
    }
  }

  if (loading) {
    return (
      <AppShell active="today">
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </AppShell>
    )
  }

  if (error || !state) {
    return (
      <AppShell active="today">
        <AOSCard>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.title}>Daily State unavailable</Text>
          <Text style={styles.copy}>{error}</Text>
          <View style={styles.buttonRow}>
            <AOSButton onPress={loadState}>Try Again</AOSButton>
          </View>
        </AOSCard>
      </AppShell>
    )
  }

  const incomplete = state.actions.filter((action) => action.status !== 'complete')
  const completed = state.actions.filter((action) => action.status === 'complete')
  const nextAction = state.nextAction

  return (
    <AppShell active="today">
      <View style={styles.header}>
        <View>
          <Text style={styles.program}>{state.user.program.toUpperCase()}</Text>
          <Text style={styles.subtitle}>{programLabel(state.user.program)}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [
            styles.accountButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.accountInitial}>
            {state.user.name.charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <AOSCard>
        <Text style={styles.eyebrow}>Current State</Text>
        <Text style={styles.title}>{state.summary.title}</Text>
        <Text style={styles.copy}>{state.summary.body}</Text>

        {state.summary.adjustmentReason ? (
          <View style={styles.adjustment}>
            <Text style={styles.adjustmentLabel}>Adjusted</Text>
            <Text style={styles.adjustmentText}>
              {state.summary.adjustmentReason}
            </Text>
          </View>
        ) : null}

        {state.priorities.length ? (
          <View style={styles.priorityRow}>
            {state.priorities.map((priority) => (
              <Text key={priority} style={styles.priority}>
                {priority}
              </Text>
            ))}
          </View>
        ) : null}
      </AOSCard>

      {state.dayComplete && state.closure ? (
        <AOSCard muted>
          <Text style={styles.eyebrow}>Closed</Text>
          <Text style={styles.sectionTitle}>{state.closure.title}</Text>
          <Text style={styles.copy}>{state.closure.body}</Text>
          <View style={styles.streakRow}>
            <Text style={styles.streakValue}>{state.execution.streak}</Text>
            <Text style={styles.streakLabel}>day streak confirmed</Text>
          </View>
          {state.closure.next ? (
            <Text style={styles.nextHint}>{state.closure.next}</Text>
          ) : null}
        </AOSCard>
      ) : (
        <AOSCard>
          <Text style={styles.eyebrow}>Next Action</Text>
          <View style={styles.nextActionHeader}>
            <Text style={styles.nextIcon}>{icons[nextAction.id]}</Text>
            <View style={styles.nextCopy}>
              <Text style={styles.nextTitle}>{nextAction.label}</Text>
              <Text style={styles.copy}>{nextAction.detail}</Text>
            </View>
          </View>
          <ProgressBar percent={nextAction.progress} />
          <View style={styles.buttonRow}>
            <AOSButton
              disabled={workingAction === nextAction.id}
              onPress={() => handleAction(nextAction)}
            >
              {workingAction === nextAction.id
                ? 'Saving'
                : actionButtonLabel(nextAction)}
            </AOSButton>
          </View>
        </AOSCard>
      )}

      <AOSCard>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.sectionTitle}>
              {incomplete.length
                ? `${incomplete.length} active`
                : 'All required work is closed'}
            </Text>
          </View>
          <Text style={styles.score}>{state.execution.score}%</Text>
        </View>

        <View style={styles.actionGrid}>
          {state.actions.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => handleAction(action)}
              style={({ pressed }) => [
                styles.action,
                actionTone(action.status),
                action.primary && styles.actionPrimary,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.actionTop}>
                <Text style={styles.actionIcon}>{icons[action.id]}</Text>
                <Text style={styles.actionProgress}>{action.progress}%</Text>
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text numberOfLines={2} style={styles.actionDetail}>
                {action.detail}
              </Text>
            </Pressable>
          ))}
        </View>
      </AOSCard>

      {state.presentation.showInsight ? (
        <AOSCard muted>
          <Text style={styles.eyebrow}>Concierge Notes</Text>
          <View style={styles.noteList}>
            {state.execution.adjustedActions.map((item) => (
              <Text key={item} style={styles.copy}>
                {item}
              </Text>
            ))}
            <Text style={styles.copy}>
              {state.nutrition.suggestions[0] || state.hydration.prompt}
            </Text>
          </View>
        </AOSCard>
      ) : null}

      {completed.length ? (
        <View style={styles.completed}>
          <Text style={styles.completedTitle}>Completed today</Text>
          <Text style={styles.completedCopy}>
            {completed.map((action) => action.label).join(' · ')}
          </Text>
        </View>
      ) : null}
    </AppShell>
  )
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  program: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  subtitle: {
    marginTop: 5,
    color: '#BA7258',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  accountButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(230,107,56,0.35)',
    borderRadius: 999,
    backgroundColor: colors.copperSoft,
  },
  accountInitial: {
    color: '#E4B18F',
    fontSize: 15,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#E0B29D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 30,
    lineHeight: 36,
  },
  copy: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  adjustment: {
    marginTop: 18,
    borderLeftWidth: 3,
    borderLeftColor: colors.copper,
    paddingLeft: 12,
  },
  adjustmentLabel: {
    color: colors.copper,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  adjustmentText: {
    marginTop: 6,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  priority: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(230,107,56,0.28)',
    borderRadius: 999,
    color: '#EAB999',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '800',
  },
  nextActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    marginBottom: 16,
  },
  nextIcon: {
    width: 54,
    color: colors.copper,
    fontSize: 40,
    textAlign: 'center',
  },
  nextCopy: {
    minWidth: 0,
    flex: 1,
  },
  nextTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  buttonRow: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    marginTop: 7,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  score: {
    color: colors.copper,
    fontFamily: 'Georgia',
    fontSize: 34,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  action: {
    width: '48%',
    minHeight: 132,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.025)',
    padding: 14,
  },
  actionPrimary: {
    borderColor: 'rgba(230,107,56,0.48)',
    backgroundColor: 'rgba(230,107,56,0.10)',
  },
  actionUrgent: {
    borderColor: 'rgba(220,63,52,0.45)',
  },
  actionActive: {
    borderColor: 'rgba(223,162,77,0.34)',
  },
  actionComplete: {
    opacity: 0.5,
  },
  actionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionIcon: {
    color: colors.copper,
    fontSize: 22,
  },
  actionProgress: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '800',
  },
  actionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  actionDetail: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  noteList: {
    gap: 8,
    marginTop: 8,
  },
  completed: {
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  completedTitle: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  completedCopy: {
    marginTop: 6,
    color: '#7E6E65',
    fontSize: 13,
    lineHeight: 19,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 18,
  },
  streakValue: {
    color: colors.copper,
    fontFamily: 'Georgia',
    fontSize: 42,
  },
  streakLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  nextHint: {
    marginTop: 12,
    color: '#EAB999',
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.75,
  },
})
