import { StyleSheet, Text, View } from 'react-native'

import type { MacroProgress } from '../lib/mockData'
import { getPercent } from '../lib/mockData'
import { colors } from '../lib/theme'
import ProgressBar from './ProgressBar'

type Props = Omit<MacroProgress, 'key'> & {
  macroKey: MacroProgress['key']
}

const macroColors: Record<MacroProgress['key'], string> = {
  protein: '#EF4568',
  carbs: colors.copper,
  fats: colors.gold,
  calories: '#BD623F',
}

export default function MacroProgressBar(props: Props) {
  const percent = getPercent(props.consumed, props.target)
  const remaining = Math.max(0, Math.round(props.target - props.consumed))
  const unit = props.unit === 'cal' ? '' : props.unit

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <View
            style={[
              styles.badge,
              {
                borderColor: macroColors[props.macroKey],
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: macroColors[props.macroKey],
                },
              ]}
            >
              {props.macroKey === 'calories' ? 'K' : props.label[0]}
            </Text>
          </View>

          <View>
            <Text style={styles.label}>{props.label}</Text>
            <Text style={styles.value}>
              {Math.round(props.consumed)}
              {unit} / {Math.round(props.target)}
              {unit}
            </Text>
          </View>
        </View>

        <View style={styles.remaining}>
          <Text style={styles.remainingValue}>
            {remaining}
            {unit}
          </Text>
          <Text style={styles.remainingLabel}>left</Text>
        </View>
      </View>

      <ProgressBar percent={percent} color={macroColors[props.macroKey]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  labelRow: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
  },
  remaining: {
    alignItems: 'flex-end',
  },
  remainingValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  remainingLabel: {
    marginTop: 2,
    color: colors.subtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})
