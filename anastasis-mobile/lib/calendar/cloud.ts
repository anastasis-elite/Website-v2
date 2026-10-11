import { supabase } from '../supabase'

export type CloudCalendarChoice = { key: string; label: string; providerCalendarId: string }
export async function getCloudCalendarChoices(): Promise<CloudCalendarChoice[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []
  const response = await fetch(`${process.env.EXPO_PUBLIC_APP_API_URL}/api/calendars`, {
    headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Cloud calendar connections could not be loaded. Try again.')
  const payload = await response.json() as { connections: {
    provider: string; account_label: string; calendars: { provider_calendar_id: string; name: string; selected: boolean }[]
  }[] }
  return (payload.connections || []).flatMap((connection) => connection.calendars.filter((calendar) => calendar.selected).map((calendar) => ({
    key: `${connection.provider}:${calendar.provider_calendar_id}`,
    label: `${connection.account_label} · ${calendar.name}`,
    providerCalendarId: calendar.provider_calendar_id,
  })))
}
export function cloudSettingsUrl() {
  return `${process.env.EXPO_PUBLIC_APP_API_URL}/dashboard/settings/calendars`
}
