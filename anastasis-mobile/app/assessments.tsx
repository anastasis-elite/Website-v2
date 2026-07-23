import { Stack } from 'expo-router'
import { SafeAreaView, StyleSheet, Text } from 'react-native'

export default function WorkoutScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: 'Workout' }} />
      <Text style={styles.heading}>Workout</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F7F4EF',
  },
  heading: {
    fontSize: 34,
    fontWeight: '700',
  },
})
