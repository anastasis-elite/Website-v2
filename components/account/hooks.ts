'use client'

import type { AccountData } from '@/lib/dashboard/account/types'

export function useAccountData(data: AccountData) { return data }
export function useClientProfile(data: AccountData) { return data.profile }
export function useProgramEnrollment(data: AccountData) { return { program: data.profile.program, subscriptionStatus: data.profile.subscriptionStatus } }
export function useJourneyStats(data: AccountData) { return data.summary }
export function useWeeklyCompletionStats(data: AccountData) { return data.journey }
export function useStreakData(data: AccountData) { return { streak: data.streak, flame: data.flame } }
