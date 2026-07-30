import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, shadow } from '../lib/theme'

type NavKey =
  | 'today'
  | 'check-in'
  | 'nutrition'
  | 'workout'
  | 'recovery'
  | 'assessments'
  | 'progress'
  | 'profile'

type Props = {
  active: NavKey
}

const primaryItems: Array<{
  key: NavKey
  label: string
  icon: string
  href: string
}> = [
  { key: 'today', label: 'Today', icon: '⌂', href: '/today' },
  { key: 'nutrition', label: 'Nutrition', icon: 'Ψ', href: '/nutrition' },
  { key: 'workout', label: 'Workout', icon: '🔥', href: '/workout' },
  { key: 'recovery', label: 'Recovery', icon: '♡', href: '/recovery' },
  { key: 'profile', label: 'More', icon: '•••', href: '/profile' },
]

export default function BottomNav({ active }: Props) {
  return (
    <View style={styles.outer}>
      <View style={styles.nav}>
        {primaryItems.map((item) => {
          const selected =
            item.key === active ||
            (item.key === 'profile' &&
              ['assessments', 'progress', 'check-in'].includes(active))
          const flame = item.key === 'workout'

          return (
            <Pressable
              key={item.key}
              onPress={() => router.push(item.href as never)}
              style={({ pressed }) => [
                styles.item,
                flame && styles.flameItem,
                selected && styles.active,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.icon,
                  flame && styles.flameIcon,
                  selected && styles.activeText,
                ]}
              >
                {item.icon}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  selected && styles.activeText,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )
        })}
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
    paddingBottom: 8,
  },
  nav: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(221,102,48,0.24)',
    borderRadius: 24,
    backgroundColor: 'rgba(8,7,6,0.96)',
    paddingHorizontal: 8,
    paddingBottom: 8,
    ...shadow,
  },
  item: {
    minWidth: 0,
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  flameItem: {
    width: 66,
    height: 66,
    flex: 0,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,126,63,0.55)',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(198,55,24,0.22)',
  },
  pressed: {
    opacity: 0.7,
  },
  active: {},
  icon: {
    color: '#8F8178',
    fontSize: 20,
  },
  flameIcon: {
    color: '#FF9B5A',
    fontSize: 25,
  },
  label: {
    color: '#8F8178',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  activeText: {
    color: colors.copper,
  },
})
