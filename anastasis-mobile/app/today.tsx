import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import MacroProgressBar from '../components/MacroProgressBar'
import MetricCard from '../components/MetricCard'
import ProgressBar from '../components/ProgressBar'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { getPercent, mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function TodayScreen() {
  const data = mockDashboard
  const hydrationPercent = getPercent(data.water.consumed, data.water.target)
  const macroPercent = Math.round(
    data.macros.reduce(
      (sum, macro) => sum + getPercent(macro.consumed, macro.target),
      0
    ) / data.macros.length
  )

  return (
    <AppShell active="today">
      <View style={styles.header}>
        <View style={styles.brand}>
          <Text style={styles.flame}>{data.flame.icon}</Text>
          <View>
            <Text style={styles.program}>{data.rhythm.title}</Text>
            <Text style={styles.subtitle}>{data.rhythm.subtitle}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [
            styles.accountButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.accountInitial}>
            {data.client.name.charAt(0)}
          </Text>
        </Pressable>
      </View>

      <View style={styles.greeting}>
        <Text style={styles.title}>
          Good Morning, {data.client.name} {data.flame.icon}
        </Text>
        <Text style={styles.copy}>{data.rhythm.message}</Text>
      </View>

      <AOSCard>
        <View style={styles.progressHeading}>
          <View>
            <Text style={styles.eyebrow}>Daily Progress</Text>
            <Text style={styles.cardTitle}>{data.flame.label}</Text>
          </View>
          <Text style={styles.score}>{data.flame.score}%</Text>
        </View>

        <ProgressBar percent={data.flame.score} />

        <View style={styles.metricGrid}>
          <MetricCard
            icon="◈"
            label="Water"
            value={`${hydrationPercent}%`}
            detail={`${data.water.consumed}/${data.water.target} oz`}
          />
          <MetricCard
            icon="Ψ"
            label="Nutrition"
            value={`${macroPercent}%`}
            detail="macro average"
          />
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            icon="↟"
            label="Workout"
            value={data.workout.complete ? 'Done' : 'Open'}
            detail={data.workout.title}
          />
          <MetricCard
            icon="✓"
            label="Assess"
            value={data.assessment.dailyComplete ? 'Done' : 'Open'}
            detail={
              data.assessment.monthlyDue ? 'monthly due' : 'daily signal'
            }
          />
        </View>
      </AOSCard>

      <AOSCard>
        <Text style={styles.eyebrow}>Today's Plan</Text>
        <View style={styles.planList}>
          {data.plan.map((block) => (
            <Pressable
              key={block.id}
              onPress={() => router.push(`/day-${block.id}` as never)}
              style={({ pressed }) => [
                styles.planBlock,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.planIcon}>
                {block.id === 'morning'
                  ? '☀'
                  : block.id === 'midday'
                    ? '◆'
                    : '◒'}
              </Text>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>{block.title}</Text>
                <Text style={styles.planFocus}>{block.focus}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </AOSCard>

      <AOSCard>
        <Text style={styles.eyebrow}>Macro Targets</Text>
        <View style={styles.macroList}>
          {data.macros.map((macro) => (
            <MacroProgressBar
              key={macro.key}
              consumed={macro.consumed}
              label={macro.label}
              macroKey={macro.key}
              target={macro.target}
              unit={macro.unit}
            />
          ))}
        </View>
        <AOSButton onPress={() => router.push('/food-log')}>
          Log Food
        </AOSButton>
      </AOSCard>

      <AOSCard muted>
        <SectionHeader
          eyebrow="Today's Insight"
          title={data.insight.title}
          copy={data.insight.observation}
        />
        <Text style={styles.insightLabel}>What it means</Text>
        <Text style={styles.copy}>{data.insight.meaning}</Text>
        <View style={styles.nextStep}>
          <Text style={styles.insightLabel}>Your next step</Text>
          <Text style={styles.nextStepText}>{data.insight.nextStep}</Text>
        </View>
      </AOSCard>

      <StateBanner
        state="loading"
        title="Live dashboard pending"
        message="This Phase 1 screen uses temporary mobile mock data until the mobile dashboard API contract is connected."
      />
    </AppShell>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flame: {
    fontSize: 40,
  },
  program: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  subtitle: {
    marginTop: 5,
    color: '#BA7258',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
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
  greeting: {
    marginBottom: 18,
  },
  title: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 29,
    lineHeight: 36,
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  eyebrow: {
    color: '#E0B29D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progressHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 15,
  },
  cardTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  score: {
    color: colors.copper,
    fontFamily: 'Georgia',
    fontSize: 34,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  planList: {
    marginTop: 14,
    gap: 10,
  },
  planBlock: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: 'rgba(225,94,45,0.16)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 14,
  },
  planIcon: {
    color: colors.copper,
    fontSize: 20,
  },
  planCopy: {
    minWidth: 0,
    flex: 1,
  },
  planTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  planFocus: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  chevron: {
    color: colors.copper,
    fontSize: 24,
  },
  macroList: {
    gap: 18,
    marginVertical: 18,
  },
  insightLabel: {
    marginBottom: 7,
    color: colors.copper,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  nextStep: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.18)',
    padding: 14,
  },
  nextStepText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.72,
  },
})
