import { StyleSheet, Text, View } from 'react-native'

type Props = {
  label: string
  consumed: number
  target: number
  unit?: string
}

export default function MacroProgressBar({
  label,
  consumed,
  target,
  unit = 'g',
}: Props) {
  const safeTarget = Math.max(0, Number(target) || 0)
  const safeConsumed = Math.max(0, Number(consumed) || 0)

  const percent =
    safeTarget > 0
      ? Math.min(100, Math.max(0, (safeConsumed / safeTarget) * 100))
      : 0

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>

        <Text style={styles.value}>
          {Math.round(safeConsumed)}
          {unit} / {Math.round(safeTarget)}
          {unit}
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: '#F5F0E8',
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    color: 'rgba(245,240,232,0.62)',
    fontSize: 12,
  },
  track: {
    width: '100%',
    height: 9,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#B56E43',
  },
})
