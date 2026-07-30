import { StyleSheet, Text, View } from 'react-native'

import { colors, radii } from '../lib/theme'

type Props = {
  state: 'loading' | 'empty' | 'complete' | 'error'
  title: string
  message: string
}

export default function StateBanner({ state, title, message }: Props) {
  return (
    <View
      style={[
        styles.banner,
        state === 'complete' && styles.complete,
        state === 'error' && styles.error,
      ]}
    >
      <Text style={styles.kicker}>{state}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.panel,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  complete: {
    borderColor: 'rgba(124,169,95,0.34)',
  },
  error: {
    borderColor: 'rgba(220,63,52,0.42)',
  },
  kicker: {
    marginBottom: 6,
    color: colors.copper,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
})
