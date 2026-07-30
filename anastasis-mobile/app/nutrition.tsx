import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import MacroProgressBar from '../components/MacroProgressBar'
import ProgressBar from '../components/ProgressBar'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { getPercent, mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function NutritionScreen() {
  const data = mockDashboard
  const waterPercent = getPercent(data.water.consumed, data.water.target)

  return (
    <AppShell active="nutrition">
      <SectionHeader
        eyebrow="Nutrition Intelligence"
        title="Today's Intake"
        copy="Track intake against the same macro and hydration priorities shown in the client platform."
      />

      <AOSCard>
        <Text style={styles.eyebrow}>Today's Fuel Readiness</Text>
        <Text style={styles.title}>Ready with support</Text>
        <Text style={styles.copy}>{data.workout.fuelPrompt}</Text>
        <View style={styles.adviceGrid}>
          <View style={styles.adviceCard}>
            <Text style={styles.adviceTitle}>Before training</Text>
            <Text style={styles.adviceCopy}>Protein plus carbs.</Text>
          </View>
          <View style={styles.adviceCard}>
            <Text style={styles.adviceTitle}>After training</Text>
            <Text style={styles.adviceCopy}>Close protein first.</Text>
          </View>
        </View>
      </AOSCard>

      <AOSCard>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.eyebrow}>Hydration</Text>
            <Text style={styles.title}>Add Water</Text>
          </View>
          <Text style={styles.waterValue}>
            {data.water.consumed}/{data.water.target} oz
          </Text>
        </View>
        <ProgressBar percent={waterPercent} color={colors.water} />
        <View style={styles.buttonRow}>
          <AOSButton variant="secondary">+ 8 oz</AOSButton>
          <AOSButton variant="secondary">+ 16 oz</AOSButton>
        </View>
      </AOSCard>

      <AOSCard>
        <Text style={styles.eyebrow}>Macro Targets + Remaining</Text>
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
          Open Food Logger
        </AOSButton>
      </AOSCard>

      <StateBanner
        state="empty"
        title="Micronutrients pending"
        message="Phase 1 shows the empty state for advanced nutrient targets. Live food search and remaining values are Phase 2 integrations."
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
    lineHeight: 29,
  },
  copy: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  adviceGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  adviceCard: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.18)',
    padding: 14,
  },
  adviceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  adviceCopy: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  waterValue: {
    color: colors.water,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  macroList: {
    gap: 18,
    marginVertical: 18,
  },
})
