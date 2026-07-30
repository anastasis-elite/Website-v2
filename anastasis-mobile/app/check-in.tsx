import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import SectionHeader from '../components/SectionHeader'
import StateBanner from '../components/StateBanner'
import { colors } from '../lib/theme'

const sliders = [
  'Sleep quality',
  'Energy',
  'Stress',
  'Soreness',
  'Mood',
  'Hunger',
]

export default function CheckInScreen() {
  const [saved, setSaved] = useState(false)

  return (
    <AppShell active="check-in">
      <SectionHeader
        eyebrow="Daily Check-In"
        title="Tell the system what today feels like."
        copy="This mirrors the client daily body signal form without saving live responses yet."
      />

      {saved ? (
        <StateBanner
          state="complete"
          title="Saved preview"
          message="The completed state is shown locally. Phase 2 will persist this to daily check-in APIs."
        />
      ) : null}

      <AOSCard>
        <Text style={styles.eyebrow}>Today's Signals</Text>
        <Text style={styles.title}>How are you, actually?</Text>
        <View style={styles.sliderList}>
          {sliders.map((label, index) => (
            <View key={label} style={styles.sliderRow}>
              <View>
                <Text style={styles.sliderLabel}>{label}</Text>
                <Text style={styles.sliderValue}>{index === 0 ? 7 : 5}/10</Text>
              </View>
              <View style={styles.fakeSlider}>
                <View
                  style={[
                    styles.fakeSliderFill,
                    { width: index === 0 ? '70%' : '50%' },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.inputLabel}>Optional notes</Text>
        <TextInput
          multiline
          placeholder="Anything else your body is telling you?"
          placeholderTextColor={colors.subtle}
          style={styles.notes}
        />

        <AOSButton onPress={() => setSaved(true)}>
          Save Daily Check-In
        </AOSButton>
      </AOSCard>

      <AOSCard muted>
        <Text style={styles.eyebrow}>Symptoms</Text>
        <View style={styles.chips}>
          {['Headache', 'Cramps', 'Bloating', 'Back', 'Knees'].map((item) => (
            <Pressable key={item} style={styles.chip}>
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </AOSCard>
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
  sliderList: {
    gap: 16,
    marginVertical: 20,
  },
  sliderRow: {
    gap: 9,
  },
  sliderLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sliderValue: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
  },
  fakeSlider: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  fakeSliderFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.copper,
  },
  inputLabel: {
    marginBottom: 8,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  notes: {
    minHeight: 104,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    backgroundColor: colors.input,
    color: colors.text,
    padding: 14,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.copperSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
})
