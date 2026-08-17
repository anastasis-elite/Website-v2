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
  completeScheduleEvent,
  completeRecoveryAction,
  deferScheduleEvent,
  getMobileDailyState,
  type MobileDailyAction,
  type MobileDailyState,
  type MobileScheduleEvent,
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

function urgencyCopy(action: MobileDailyAction) {
  if (action.urgency === 'overdue') return 'Overdue'
  if (action.urgency === 'now') return 'Now'
  if (action.urgency === 'soon') return 'Soon'
  if (action.urgency === 'upcoming') return 'Upcoming'
  return 'Open'
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

  async function completeEvent(event: MobileScheduleEvent) {
    if (!event.can_complete) {
      Alert.alert('Approval needed', 'This schedule item cannot be changed from mobile.')
      return
    }

    try {
      setWorkingAction(event.id)
      await completeScheduleEvent(event.id)
      await loadState()
    } catch (actionError) {
      Alert.alert(
        'Action unavailable',
        actionError instanceof Error
          ? actionError.message
          : 'The event could not be completed.',
      )
    } finally {
      setWorkingAction(null)
    }
  }

  async function deferEvent(event: MobileScheduleEvent) {
    if (!event.can_defer) {
      Alert.alert('Suggestion only', 'This schedule item needs approval before it can move.')
      return
    }

    try {
      setWorkingAction(`defer-${event.id}`)
      await deferScheduleEvent(event.id)
      await loadState()
    } catch (actionError) {
      Alert.alert(
        'Defer unavailable',
        actionError instanceof Error
          ? actionError.message
          : 'No valid defer window was found.',
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

  const completed = state.actions.filter((action) => action.status === 'complete')
  const nextAction = state.nextAction
  const remainingEvents = state.scheduleEvents || []

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

      {state.dayComplete && state.closure ? (
        <AOSCard muted>
          <Text style={styles.eyebrow}>Day Complete</Text>
          <Text style={styles.title}>Today is closed</Text>
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
          <Text style={styles.eyebrow}>Now</Text>
          <View style={styles.nextActionHeader}>
            <Text style={styles.nextIcon}>{icons[nextAction.id]}</Text>
            <View style={styles.nextCopy}>
              <Text style={styles.urgency}>{urgencyCopy(nextAction)}</Text>
              <Text style={styles.nextTitle}>{nextAction.label}</Text>
              <Text style={styles.copy}>{nextAction.reason || nextAction.detail}</Text>
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
          {nextAction.scheduleEventId && (nextAction.can_complete || nextAction.can_defer) ? (
            <View style={styles.inlineActions}>
              {nextAction.can_complete ? (
                <Pressable
                  onPress={() => {
                    const event = remainingEvents.find((item) => item.id === nextAction.scheduleEventId)
                    if (event) completeEvent(event)
                  }}
                  style={styles.inlineButton}
                >
                  <Text style={styles.inlineButtonText}>Complete</Text>
                </Pressable>
              ) : null}
              {nextAction.can_defer ? (
                <Pressable
                  onPress={() => {
                    const event = remainingEvents.find((item) => item.id === nextAction.scheduleEventId)
                    if (event) deferEvent(event)
                  }}
                  style={styles.inlineButton}
                >
                  <Text style={styles.inlineButtonText}>Defer</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </AOSCard>
      )}

      <AOSCard>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>Quick Actions</Text>
            <Text style={styles.sectionTitle}>Command layer</Text>
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

      <AOSCard>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.sectionTitle}>
              {remainingEvents.length
                ? `${remainingEvents.length} remaining`
                : 'No remaining schedule actions'}
            </Text>
          </View>
        </View>

        <View style={styles.scheduleList}>
          {remainingEvents.slice(0, 6).map((event) => (
            <View
              key={event.id}
              style={[
                styles.scheduleEvent,
                event.priority === 'high' || event.priority === 'critical'
                  ? styles.scheduleEventUrgent
                  : null,
              ]}
            >
              <View style={styles.scheduleEventCopy}>
                <Text style={styles.actionLabel}>{event.title}</Text>
                <Text numberOfLines={2} style={styles.actionDetail}>
                  {event.category.replace('_', ' ')}
                  {event.adjusted ? ` · ${event.adjustment_reason}` : ''}
                </Text>
              </View>
              <View style={styles.eventButtons}>
                {event.can_defer ? (
                  <Pressable
                    disabled={workingAction === `defer-${event.id}`}
                    onPress={() => deferEvent(event)}
                    style={styles.eventButton}
                  >
                    <Text style={styles.eventButtonText}>Defer</Text>
                  </Pressable>
                ) : null}
                {event.can_complete ? (
                  <Pressable
                    disabled={workingAction === event.id}
                    onPress={() => completeEvent(event)}
                    style={styles.eventButton}
                  >
                    <Text style={styles.eventButtonText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </AOSCard>

      <AOSCard muted>
        <Text style={styles.eyebrow}>Totals</Text>
        <View style={styles.totalsGrid}>
          <View style={styles.totalCell}>
            <Text style={styles.totalValue}>{Math.round(state.hydration.consumed)}</Text>
            <Text style={styles.totalLabel}>oz water</Text>
          </View>
          <View style={styles.totalCell}>
            <Text style={styles.totalValue}>{Math.round(state.nutrition.protein.consumed)}</Text>
            <Text style={styles.totalLabel}>g protein</Text>
          </View>
          <View style={styles.totalCell}>
            <Text style={styles.totalValue}>{state.execution.streak}</Text>
            <Text style={styles.totalLabel}>streak</Text>
          </View>
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
  urgency: {
    marginBottom: 4,
    color: colors.copper,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  buttonRow: {
    marginTop: 16,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  inlineButton: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(230,107,56,0.34)',
    borderRadius: 12,
    backgroundColor: 'rgba(230,107,56,0.08)',
  },
  inlineButtonText: {
    color: '#EAB999',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
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
  scheduleList: {
    gap: 10,
  },
  scheduleEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.022)',
    padding: 12,
  },
  scheduleEventUrgent: {
    borderColor: 'rgba(230,107,56,0.42)',
    backgroundColor: 'rgba(230,107,56,0.08)',
  },
  scheduleEventCopy: {
    minWidth: 0,
    flex: 1,
  },
  eventButtons: {
    gap: 8,
  },
  eventButton: {
    minWidth: 66,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(230,107,56,0.32)',
    borderRadius: 10,
    backgroundColor: 'rgba(230,107,56,0.06)',
  },
  eventButtonText: {
    color: '#EAB999',
    fontSize: 11,
    fontWeight: '900',
  },
  totalsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  totalCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 12,
  },
  totalValue: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 28,
  },
  totalLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
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
