import { Platform } from 'react-native'

import { AppleHealthAdapter } from './appleHealthAdapter'
import { HealthConnectAdapter } from './healthConnectAdapter'
import type { HealthProviderAdapter } from './types'

export function getHealthProviderAdapter(): HealthProviderAdapter | null {
  if (Platform.OS === 'ios') return AppleHealthAdapter
  if (Platform.OS === 'android') return HealthConnectAdapter
  return null
}
