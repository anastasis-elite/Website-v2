import { StyleSheet, Text, View } from 'react-native'

import { colors, radii } from '../lib/theme'

type Props = {
  icon: string
  label: string
  value: string
  detail?: string
}

export default function MetricCard({ icon, label, value, detail }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 112,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(225,94,45,0.16)',
    borderRadius: radii.panel,
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 12,
  },
  icon: {
    color: colors.copper,
    fontSize: 22,
  },
  label: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 7,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  detail: {
    marginTop: 4,
    color: colors.subtle,
    fontSize: 11,
    textAlign: 'center',
  },
})
