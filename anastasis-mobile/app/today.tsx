import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { supabase } from '../lib/supabase'

type MacroName = 'Protein' | 'Carbs' | 'Fats' | 'Calories'

type MacroProgress = {
  name: MacroName
  consumed: number
  target: number
  unit: 'g' | 'cal'
}

type DashboardData = {
  rhythm: {
    phaseName: string
    message: string
  }
  insight: {
    title: string
    observation: string
    meaning: string
    nextStep: string
  }
  flameScore: number
  flameState: string
  cycleDay: number | null
  cycleLength: number
  cyclePhase: string | null
  waterConsumed: number
  waterTarget: number
  assessmentDueCount: number
  macros: MacroProgress[]
}

/*
 * TEMPORARY VISUAL DATA
 *
 * This allows us to finish and approve the Today-screen design first.
 * Next, this object will be replaced with data returned by:
 *
 * GET /api/mobile/dashboard
 */
const temporaryDashboardData: DashboardData = {
  rhythm: {
    phaseName: 'Build Capacity',
    message:
      'Your inputs suggest that today supports steady execution without adding unnecessary pressure.',
  },
  insight: {
    title: 'Protect the capacity you are building.',
    observation:
      'Your consistency is improving, but your recovery inputs show that your available energy still needs to be protected.',
    meaning:
      'More effort is not automatically the answer. The goal is to use today’s available capacity intentionally.',
    nextStep:
      'Complete the highest-priority action first, then reassess before adding more.',
  },
  flameScore: 74,
  flameState: 'steady',
  cycleDay: 18,
  cycleLength: 30,
  cyclePhase: 'Luteal',
  waterConsumed: 56,
  waterTarget: 100,
  assessmentDueCount: 1,
  macros: [
    {
      name: 'Protein',
      consumed: 118,
      target: 175,
      unit: 'g',
    },
    {
      name: 'Carbs',
      consumed: 164,
      target: 240,
      unit: 'g',
    },
    {
      name: 'Fats',
      consumed: 52,
      target: 80,
      unit: 'g',
    },
    {
      name: 'Calories',
      consumed: 1710,
      target: 2500,
      unit: 'cal',
    },
  ],
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value))
}

function getRemaining(consumed: number, target: number) {
  return Math.max(0, Math.round(target - consumed))
}

function MacroProgressBar({
  name,
  consumed,
  target,
  unit,
}: MacroProgress) {
  const percentage =
    target > 0
      ? clampPercentage((consumed / target) * 100)
      : 0

  const remaining = getRemaining(consumed, target)

  return (
    <View style={styles.macroItem}>
      <View style={styles.macroHeader}>
        <View>
          <Text style={styles.macroName}>{name}</Text>

          <Text style={styles.macroRemaining}>
            {remaining}
            {unit === 'g' ? 'g' : ''} remaining
          </Text>
        </View>

        <Text style={styles.macroValue}>
          {Math.round(consumed)}
          {unit === 'g' ? 'g' : ''}

          <Text style={styles.macroTarget}>
            {' '}
            / {Math.round(target)}
            {unit === 'g' ? 'g' : ''}
          </Text>
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%`,
            },
          ]}
        />
      </View>
    </View>
  )
}

type DockMetricProps = {
  value: string
  label: string
  onPress?: () => void
}

function DockMetric({
  value,
  label,
  onPress,
}: DockMetricProps) {
  const content = (
    <>
      <Text numberOfLines={1} style={styles.dockMetricValue}>
        {value}
      </Text>

      <Text numberOfLines={1} style={styles.dockMetricLabel}>
        {label}
      </Text>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.dockMetric,
          pressed && styles.dockPressed,
        ]}
      >
        {content}
      </Pressable>
    )
  }

  return <View style={styles.dockMetric}>{content}</View>
}

export default function TodayScreen() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const dashboard = temporaryDashboardData

  useEffect(() => {
    let active = true

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return

      if (!session) {
        router.replace('/login')
        return
      }

      setEmail(session.user.email ?? null)
      setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return

      if (!session) {
        router.replace('/login')
        return
      }

      setEmail(session.user.email ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const protein = dashboard.macros.find(
    (macro) => macro.name === 'Protein'
  )

  const carbs = dashboard.macros.find(
    (macro) => macro.name === 'Carbs'
  )

  const fats = dashboard.macros.find(
    (macro) => macro.name === 'Fats'
  )

  const proteinRemaining = protein
    ? getRemaining(protein.consumed, protein.target)
    : 0

  const carbsRemaining = carbs
    ? getRemaining(carbs.consumed, carbs.target)
    : 0

  const fatsRemaining = fats
    ? getRemaining(fats.consumed, fats.target)
    : 0

  const waterRemaining = getRemaining(
    dashboard.waterConsumed,
    dashboard.waterTarget
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#B56E43" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>ANASTASIS</Text>
            <Text style={styles.pageTitle}>Today</Text>
          </View>

          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.accountButton,
              pressed && styles.accountButtonPressed,
            ]}
          >
            <Text style={styles.accountInitial}>
              {email?.charAt(0).toUpperCase() || 'A'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>TODAY&apos;S RHYTHM</Text>

          <Text style={styles.heroTitle}>
            {dashboard.rhythm.phaseName}
          </Text>

          <Text style={styles.bodyText}>
            {dashboard.rhythm.message}
          </Text>

          <View style={styles.focusRow}>
            <Pressable
              onPress={() => router.push('/workout')}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                Open today&apos;s plan
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/cycle')}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Cycle
              </Text>
            </Pressable>
          </View>

          <View style={styles.flameContainer}>
            <View style={styles.flameHeader}>
              <View>
                <Text style={styles.flameLabel}>
                  Your Flame
                </Text>

                <Text style={styles.flameState}>
                  {dashboard.flameState}
                </Text>
              </View>

              <Text style={styles.flameScore}>
                {Math.round(dashboard.flameScore)}%
              </Text>
            </View>

            <View style={styles.flameTrack}>
              <View
                style={[
                  styles.flameFill,
                  {
                    width: `${clampPercentage(
                      dashboard.flameScore
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            TODAY&apos;S INSIGHT
          </Text>

          <Text style={styles.sectionTitle}>
            {dashboard.insight.title}
          </Text>

          <View style={styles.insightBlock}>
            <Text style={styles.insightLabel}>
              WHAT WE&apos;RE SEEING
            </Text>

            <Text style={styles.bodyText}>
              {dashboard.insight.observation}
            </Text>
          </View>

          <View style={styles.insightDivider} />

          <View style={styles.insightBlock}>
            <Text style={styles.insightLabel}>
              WHAT IT MEANS
            </Text>

            <Text style={styles.bodyText}>
              {dashboard.insight.meaning}
            </Text>
          </View>

          <View style={styles.nextStepCard}>
            <Text style={styles.insightLabel}>
              YOUR NEXT STEP
            </Text>

            <Text style={styles.nextStepText}>
              {dashboard.insight.nextStep}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>NUTRITION</Text>

              <Text style={styles.sectionTitle}>
                Today&apos;s macros
              </Text>
            </View>

            <Pressable
              onPress={() => router.push('/nutrition')}
              style={({ pressed }) => [
                styles.smallAction,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.smallActionText}>
                Open
              </Text>
            </Pressable>
          </View>

          <View style={styles.macroList}>
            {dashboard.macros.map((macro) => (
              <MacroProgressBar
                key={macro.name}
                {...macro}
              />
            ))}
          </View>
        </View>

        <Text style={styles.previewNotice}>
          Dashboard values are temporary while the mobile
          dashboard endpoint is connected.
        </Text>
      </ScrollView>

      <View style={styles.dockArea}>
        <View style={styles.dock}>
          <View style={styles.flameDockMetric}>
            <Text style={styles.dockFlame}>🔥</Text>

            <Text style={styles.dockMetricValue}>
              {Math.round(dashboard.flameScore)}%
            </Text>

            <Text style={styles.dockMetricLabel}>
              {dashboard.flameState}
            </Text>
          </View>

          <DockMetric
            value={
              dashboard.cycleDay
                ? `D${dashboard.cycleDay}`
                : '—'
            }
            label={dashboard.cyclePhase || 'cycle'}
            onPress={() => router.push('/cycle')}
          />

          <DockMetric
            value={`${proteinRemaining}g`}
            label="protein"
            onPress={() => router.push('/nutrition')}
          />

          <DockMetric
            value={`${carbsRemaining}g`}
            label="carbs"
            onPress={() => router.push('/nutrition')}
          />

          <DockMetric
            value={`${fatsRemaining}g`}
            label="fats"
            onPress={() => router.push('/nutrition')}
          />

          <DockMetric
            value={`${waterRemaining}`}
            label="water"
            onPress={() => router.push('/nutrition')}
          />

          <Pressable
            onPress={() => router.push('/nutrition')}
            style={({ pressed }) => [
              styles.dockAction,
              pressed && styles.dockPressed,
            ]}
          >
            <Text style={styles.dockActionText}>+</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/assessments')}
            style={({ pressed }) => [
              styles.dockAction,
              pressed && styles.dockPressed,
            ]}
          >
            <Text style={styles.dockActionText}>
              {dashboard.assessmentDueCount > 0
                ? dashboard.assessmentDueCount
                : '*'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#090807',
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090807',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 132,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  brand: {
    marginBottom: 5,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3.2,
    color: '#B56E43',
  },

  pageTitle: {
    fontSize: 35,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#F5F0E8',
  },

  accountButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.35)',
    borderRadius: 999,
    backgroundColor: 'rgba(181,110,67,0.10)',
  },

  accountButtonPressed: {
    opacity: 0.65,
  },

  accountInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E4B18F',
  },

  heroCard: {
    marginBottom: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.18)',
    borderRadius: 28,
    backgroundColor: '#12100E',
  },

  card: {
    marginBottom: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 28,
    backgroundColor: '#11100E',
  },

  eyebrow: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#B56E43',
  },

  heroTitle: {
    marginBottom: 12,
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#F5F0E8',
  },

  sectionTitle: {
    marginBottom: 18,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#F5F0E8',
  },

  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(245,240,232,0.70)',
  },

  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },

  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#B56E43',
  },

  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#130E0B',
  },

  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.30)',
    borderRadius: 999,
    backgroundColor: 'rgba(181,110,67,0.07)',
  },

  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E4B18F',
  },

  buttonPressed: {
    opacity: 0.68,
  },

  flameContainer: {
    marginTop: 24,
    padding: 17,
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.17)',
    borderRadius: 22,
    backgroundColor: 'rgba(181,110,67,0.07)',
  },

  flameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  flameLabel: {
    marginBottom: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#F5F0E8',
  },

  flameState: {
    fontSize: 11,
    textTransform: 'capitalize',
    color: 'rgba(245,240,232,0.48)',
  },

  flameScore: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E4B18F',
  },

  flameTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  flameFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#C98255',
  },

  insightBlock: {
    gap: 7,
  },

  insightLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(228,177,143,0.76)',
  },

  insightDivider: {
    height: 1,
    marginVertical: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  nextStepCard: {
    gap: 8,
    marginTop: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.18)',
    borderRadius: 20,
    backgroundColor: 'rgba(181,110,67,0.07)',
  },

  nextStepText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    color: '#F0D7C6',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },

  smallAction: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.25)',
    borderRadius: 999,
  },

  smallActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E4B18F',
  },

  macroList: {
    gap: 22,
  },

  macroItem: {
    gap: 10,
  },

  macroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },

  macroName: {
    marginBottom: 3,
    fontSize: 14,
    fontWeight: '700',
    color: '#F5F0E8',
  },

  macroRemaining: {
    fontSize: 11,
    color: 'rgba(245,240,232,0.44)',
  },

  macroValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5F0E8',
  },

  macroTarget: {
    fontWeight: '400',
    color: 'rgba(245,240,232,0.45)',
  },

  progressTrack: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#B56E43',
  },

  previewNotice: {
    paddingHorizontal: 12,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    color: 'rgba(245,240,232,0.30)',
  },

  dockArea: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'rgba(9,8,7,0.94)',
  },

  dock: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 28,
    backgroundColor: '#0D0C0B',
  },

  dockMetric: {
    minWidth: 36,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
  },

  flameDockMetric: {
    minWidth: 40,
    flex: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dockFlame: {
    marginBottom: 1,
    fontSize: 15,
  },

  dockMetricValue: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: '#F5F0E8',
  },

  dockMetricLabel: {
    maxWidth: 46,
    marginTop: 2,
    fontSize: 7,
    textAlign: 'center',
    textTransform: 'lowercase',
    color: 'rgba(245,240,232,0.44)',
  },

  dockAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.34)',
    borderRadius: 999,
    backgroundColor: 'rgba(181,110,67,0.09)',
  },

  dockActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F5F0E8',
  },

  dockPressed: {
    opacity: 0.55,
  },
})
