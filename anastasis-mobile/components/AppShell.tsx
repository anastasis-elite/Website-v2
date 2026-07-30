import type { ReactNode } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native'

import { colors, spacing } from '../lib/theme'
import BottomNav from './BottomNav'

type Props = {
  children: ReactNode
  active:
    | 'today'
    | 'check-in'
    | 'nutrition'
    | 'workout'
    | 'recovery'
    | 'assessments'
    | 'progress'
    | 'profile'
  showNav?: boolean
}

export default function AppShell({
  children,
  active,
  showNav = true,
}: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          showNav && styles.withNav,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {showNav ? <BottomNav active={active} /> : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.pageX,
    paddingTop: spacing.pageTop,
    paddingBottom: 28,
  },
  withNav: {
    paddingBottom: spacing.navBottom,
  },
})
