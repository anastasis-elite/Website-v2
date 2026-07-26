import { Pressable, StyleSheet, Text, View } from 'react-native'

type Props = {
  flameScore: number
  cycleDay: number | null
  cyclePhase: string | null
  proteinRemaining: number
  carbsRemaining: number
  fatsRemaining: number
  waterRemaining: number
  assessmentDueCount: number
  onCyclePress?: () => void
  onWaterPress?: () => void
  onQuickAddPress?: () => void
  onAssessmentPress?: () => void
}

export default function DashboardControlDock({
  flameScore,
  cycleDay,
  cyclePhase,
  proteinRemaining,
  carbsRemaining,
  fatsRemaining,
  waterRemaining,
  assessmentDueCount,
  onCyclePress,
  onWaterPress,
  onQuickAddPress,
  onAssessmentPress,
}: Props) {
  return (
    <View style={styles.outer}>
      <View style={styles.dock}>
        <View style={styles.item}>
          <Text style={styles.icon}>🔥</Text>
          <Text style={styles.value}>{Math.round(flameScore)}%</Text>
          <Text style={styles.label}>flame</Text>
        </View>

        <Pressable onPress={onCyclePress} style={styles.item}>
          <Text style={styles.value}>
            {cycleDay ? `D${cycleDay}` : '—'}
          </Text>
          <Text numberOfLines={1} style={styles.label}>
            {cyclePhase || 'cycle'}
          </Text>
        </Pressable>

        <View style={styles.item}>
          <Text style={styles.value}>{Math.round(proteinRemaining)}g</Text>
          <Text style={styles.label}>protein</Text>
        </View>

        <View style={styles.item}>
          <Text style={styles.value}>{Math.round(carbsRemaining)}g</Text>
          <Text style={styles.label}>carbs</Text>
        </View>

        <View style={styles.item}>
          <Text style={styles.value}>{Math.round(fatsRemaining)}g</Text>
          <Text style={styles.label}>fats</Text>
        </View>

        <Pressable onPress={onWaterPress} style={styles.item}>
          <Text style={styles.icon}>◒</Text>
          <Text style={styles.value}>{Math.round(waterRemaining)}</Text>
          <Text style={styles.label}>water</Text>
        </Pressable>

        <Pressable onPress={onQuickAddPress} style={styles.action}>
          <Text style={styles.actionText}>+</Text>
        </Pressable>

        <Pressable onPress={onAssessmentPress} style={styles.action}>
          <Text style={styles.actionText}>
            {assessmentDueCount > 0 ? assessmentDueCount : '*'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  dock: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(8,8,8,0.96)',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.42,
    shadowRadius: 30,
    elevation: 18,
  },
  item: {
    minWidth: 39,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  icon: {
    color: '#F5F0E8',
    fontSize: 15,
  },
  value: {
    color: '#F5F0E8',
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    maxWidth: 46,
    color: 'rgba(245,240,232,0.55)',
    fontSize: 8,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  action: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(181,110,67,0.34)',
    borderRadius: 999,
    backgroundColor: 'rgba(181,110,67,0.09)',
  },
  actionText: {
    color: '#F5F0E8',
    fontSize: 17,
    lineHeight: 19,
  },
})
