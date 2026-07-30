import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../lib/theme'

type Props = {
  eyebrow: string
  title: string
  copy?: string
}

export default function SectionHeader({ eyebrow, title, copy }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {copy ? <Text style={styles.copy}>{copy}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  eyebrow: {
    marginBottom: 8,
    color: colors.copper,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 34,
  },
  copy: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
})
