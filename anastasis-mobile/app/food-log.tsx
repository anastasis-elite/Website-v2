import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import MacroProgressBar from '../components/MacroProgressBar'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { mockDashboard } from '../lib/mockData'
import { colors } from '../lib/theme'

export default function FoodLogScreen() {
  const [saved, setSaved] = useState(false)

  return (
    <AppShell active="nutrition">
      <SectionHeader
        eyebrow="Food Logging"
        title="Log Food"
        copy="Search, serving selection, and nutrient calculation are represented with temporary local data in Phase 1."
      />

      {saved ? (
        <StateBanner
          state="complete"
          title="Food logged preview"
          message="The visual success state is local. No meal was saved to the platform."
        />
      ) : null}

      <AOSCard>
        <Text style={styles.inputLabel}>Food search</Text>
        <TextInput
          placeholder="Search foods"
          placeholderTextColor={colors.subtle}
          style={styles.input}
        />

        <View style={styles.result}>
          <View>
            <Text style={styles.resultTitle}>Greek yogurt bowl</Text>
            <Text style={styles.resultMeta}>
              320 cal · 31g protein · 42g carbs · 4g fat
            </Text>
          </View>
          <Text style={styles.plus}>+</Text>
        </View>

        <AOSButton onPress={() => setSaved(true)}>Add Food</AOSButton>
      </AOSCard>

      <AOSCard muted>
        <Text style={styles.eyebrow}>Remaining After Mock Meal</Text>
        <View style={styles.macroList}>
          {mockDashboard.macros.map((macro) => (
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
      </AOSCard>

      <StateBanner
        state="error"
        title="Food search unavailable"
        message="This is the mobile error presentation for a failed food search. Live search is not connected in Phase 1."
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
  inputLabel: {
    marginBottom: 8,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    backgroundColor: colors.input,
    color: colors.text,
    paddingHorizontal: 14,
  },
  result: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 14,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  resultMeta: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12,
  },
  plus: {
    color: colors.copper,
    fontSize: 28,
  },
  macroList: {
    gap: 18,
    marginTop: 18,
  },
})
