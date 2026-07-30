import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { colors, radii, shadow } from '../lib/theme'

type Props = {
  children: ReactNode
  muted?: boolean
}

export default function AOSCard({ children, muted }: Props) {
  return (
    <View style={[styles.card, muted && styles.muted]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...shadow,
  },
  muted: {
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceMuted,
  },
})
