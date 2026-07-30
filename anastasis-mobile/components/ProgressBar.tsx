import { StyleSheet, View } from 'react-native'

import { colors, radii } from '../lib/theme'

type Props = {
  percent: number
  color?: string
}

export default function ProgressBar({
  percent,
  color = colors.copper,
}: Props) {
  const width = `${Math.min(100, Math.max(0, percent))}%`

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 7,
    overflow: 'hidden',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
})
