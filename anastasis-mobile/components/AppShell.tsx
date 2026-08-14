import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'

import { useProtectedSession } from '../lib/auth'
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
  const { loading, session } = useProtectedSession()

  if (loading || !session) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    )
  }

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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
