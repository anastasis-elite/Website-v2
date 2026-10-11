import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'

import AOSButton from '../components/AOSButton'
import AOSCard from '../components/AOSCard'
import AppShell from '../components/AppShell'
import SectionHeader from '../components/SectionHeader'
import { getMobileDailyState, type MobileScheduleEvent } from '../lib/dashboard'
import { colors } from '../lib/theme'
import { cloudSettingsUrl, getCloudCalendarChoices, type CloudCalendarChoice } from '../lib/calendar/cloud'
import {
  connectDeviceCalendars, createDeviceEvent, deleteDeviceEvent, disconnectDeviceCalendars,
  editDeviceRecurringEvent, saveDevicePreferences, updateDeviceEvent,
  type DeviceEvent, type DeviceEventDraft, type DevicePreferences,
} from '../lib/calendar/device'
import { dateInZone, shouldSuppressDeviceCalendar, suggestOpenings, wallDateTime } from '../lib/calendar/logic'
import { useDeviceCalendar } from '../lib/calendar/useDeviceCalendar'

function freshDraft(): DeviceEventDraft {
  const start = new Date(); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return {
    title: 'Personal time', start: wallDateTime(start, timezone), end: wallDateTime(new Date(start.getTime() + 30 * 60000), timezone),
    timezone, allDay: false, location: '', notes: '',
    reminderMinutes: 10, recurrence: 'none', occurrences: 8,
  }
}
function time(event: { start_at: string; end_at: string; allDay?: boolean }) {
  if (event.allDay) return 'All day'
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(event.start_at).toLocaleTimeString(undefined, options)} – ${new Date(event.end_at).toLocaleTimeString(undefined, options)}`
}

export default function CalendarScreen() {
  const { snapshot, loading, error, refresh } = useDeviceCalendar()
  const [working, setWorking] = useState(false)
  const [cloud, setCloud] = useState<CloudCalendarChoice[]>([])
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<MobileScheduleEvent[]>([])
  const [draft, setDraft] = useState<DeviceEventDraft>(freshDraft)
  const [requestId, setRequestId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const [editing, setEditing] = useState<DeviceEvent | null>(null)
  const [chosenDestination, setDestination] = useState<string | null>(null)
  const [duration, setDuration] = useState('30')
  const preferences = snapshot?.preferences
  const destination = chosenDestination || preferences?.defaultCalendar || null

  const refreshCloud = useCallback(async () => {
    const results = await Promise.allSettled([getCloudCalendarChoices(), getMobileDailyState()])
    if (results[0].status === 'fulfilled') { setCloud(results[0].value); setCloudError(null) }
    else { setCloud([]); setCloudError('Cloud calendars could not refresh. Device appointments are shown until you retry.') }
    if (results[1].status === 'fulfilled') setSchedule(results[1].value.scheduleEvents || [])
  }, [])
  useFocusEffect(useCallback(() => { void refreshCloud() }, [refreshCloud]))
  const events = useMemo(() => (snapshot?.events || []).filter((event) =>
    !shouldSuppressDeviceCalendar(event.calendarId, preferences?.cloudMappings || {}, cloud.map((calendar) => calendar.key)),
  ), [snapshot?.events, preferences?.cloudMappings, cloud])
  const slots = useMemo(() => suggestOpenings(new Date(), Number(duration), [...events, ...schedule],
    preferences?.hours || { start: 6, end: 21, bufferMinutes: 15 }), [events, schedule, duration, preferences?.hours])

  async function run(action: () => Promise<void>) {
    setWorking(true)
    try { await action(); await refresh() }
    catch (failure) { Alert.alert('Calendar action unavailable', failure instanceof Error ? failure.message : 'Please try again.') }
    finally { setWorking(false) }
  }
  async function changePreferences(patch: Partial<DevicePreferences>) {
    if (preferences) await run(() => saveDevicePreferences({ ...preferences, ...patch }))
  }
  function chooseEvent(event: DeviceEvent) {
    setEditing(event); setDestination(event.calendarId)
    setDraft({ ...freshDraft(), title: event.title, start: wallDateTime(new Date(event.start_at), event.timezone), end: wallDateTime(new Date(event.end_at), event.timezone),
      timezone: event.timezone, allDay: event.allDay, location: event.location, notes: event.notes,
      preserveAlarms: event.alarms, reminderMinutes: event.alarms[0]?.relativeOffset == null ? null : Math.abs(event.alarms[0].relativeOffset),
      ...(event.allDay ? { start: event.start_date || dateInZone(new Date(event.start_at), event.timezone), end: event.end_date || dateInZone(new Date(event.end_at), event.timezone) } : {}) })
  }
  function confirmSave() {
    if (!destination) { Alert.alert('Choose a calendar', 'Select a writable destination before saving.'); return }
    Alert.alert(editing ? 'Update this appointment?' : 'Add this event?',
      `${draft.title} will be saved to the selected device calendar. Your title and notes may be visible to people sharing that calendar.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => { void run(async () => {
          if (editing) await updateDeviceEvent(editing, draft)
          else await createDeviceEvent(destination, draft, requestId)
          Alert.alert('Saved to device calendar', 'The event was confirmed in the device calendar store. Cloud delivery depends on your device account sync.')
          setEditing(null); setDraft(freshDraft()); setRequestId(`${Date.now()}-${Math.random().toString(36).slice(2)}`)
        }) } },
      ])
  }
  function confirmDelete(event: DeviceEvent) {
    Alert.alert('Delete this appointment?', `${event.title} will be removed from its device calendar.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void run(async () => {
        await deleteDeviceEvent(event); Alert.alert('Deleted', 'The device calendar accepted the deletion.')
      }) } },
    ])
  }
  const label = Platform.OS === 'ios' ? 'Apple device calendars' : 'Android device calendars'
  return (
    <AppShell active="today">
      <SectionHeader eyebrow="Calendar" title="Your time, together" copy="Keep your commitments alongside Anastasis activities. Connecting a calendar is optional." />
      <AOSCard>
        <Text style={styles.title}>Connected calendars</Text>
        <Text style={styles.copy}>
          {Platform.OS === 'web' ? 'Browser pages cannot read your device calendars.' : `${label} uses calendars already available on this phone. An iCloud account connection is a separate web option.`}
        </Text>
        <Text style={styles.copy}>Status: {snapshot?.status || (loading ? 'Loading' : 'Unavailable')}</Text>
        <Text style={styles.copy}>Last successful device refresh: {preferences?.lastSync ? new Date(preferences.lastSync).toLocaleString() : 'Never'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {cloudError ? <Text style={styles.error}>{cloudError}</Text> : null}
        <View style={styles.actions}>
          {Platform.OS !== 'web' ? <>
            <AOSButton disabled={working} onPress={() => { void run(connectDeviceCalendars) }}>{preferences?.connected ? 'Reconnect permissions' : `Connect ${label}`}</AOSButton>
            <AOSButton variant="secondary" disabled={working} onPress={() => { void run(async () => { await refresh(); await refreshCloud() }) }}>Refresh</AOSButton>
            <AOSButton variant="secondary" onPress={() => { void Linking.openSettings() }}>Open device permissions</AOSButton>
            {preferences?.connected ? <AOSButton variant="danger" disabled={working} onPress={() => {
              Alert.alert('Disconnect device calendars?', 'Anastasis will stop accessing calendars and clear its local settings and write mappings. Your external events remain.', [
                { text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: () => { void run(disconnectDeviceCalendars) } },
              ])
            }}>Disconnect</AOSButton> : null}
          </> : null}
          <AOSButton variant="secondary" onPress={() => { void Linking.openURL(cloudSettingsUrl()) }}>Connect Google or iCloud on web</AOSButton>
        </View>
        <Text style={styles.copy}>Cloud account linking opens Anastasis in your browser. Sign into the same Anastasis account there. It does not change your app login.</Text>
      </AOSCard>

      {preferences?.connected ? <AOSCard>
        <Text style={styles.title}>Choose what Anastasis reads</Text>
        <Text style={styles.copy}>Device appointment details stay on this device. Select a writable default separately.</Text>
        {(snapshot?.calendars || []).map((calendar) => <View key={calendar.id} style={styles.calendar}>
          <View style={styles.row}>
            <View style={styles.flex}><Text style={styles.label}>{calendar.title}</Text><Text style={styles.copy}>{calendar.account} · {calendar.writable ? 'Writable' : 'Read-only'}</Text></View>
            <Switch accessibilityLabel={`Read ${calendar.title}`} value={preferences.selected.includes(calendar.id)} onValueChange={(selected) => { void changePreferences({ selected: selected ? [...preferences.selected, calendar.id] : preferences.selected.filter((id) => id !== calendar.id) }) }} />
          </View>
          {calendar.writable ? <AOSButton variant="secondary" disabled={working} onPress={() => { setDestination(calendar.id); void changePreferences({ defaultCalendar: calendar.id }) }}>{preferences.defaultCalendar === calendar.id ? 'Default for new events' : 'Use as default'}</AOSButton> : null}
          {cloud.length ? <>
            <Text style={styles.copy}>Already connected to this exact calendar through the cloud? Select its matching account and calendar to show one copy.</Text>
            {cloud.map((choice) => <Pressable key={choice.key} style={styles.option} accessibilityRole="button" onPress={() => {
              const mappings = { ...preferences.cloudMappings }
              if (mappings[calendar.id] === choice.key) delete mappings[calendar.id]
              else mappings[calendar.id] = choice.key
              void changePreferences({ cloudMappings: mappings })
            }}><Text style={styles.copy}>{preferences.cloudMappings[calendar.id] === choice.key ? '✓ ' : '○ '}{choice.label}</Text></Pressable>)}
          </> : null}
        </View>)}
      </AOSCard> : null}

      <AOSCard>
        <Text style={styles.title}>Today’s commitments</Text>
        {[...events, ...schedule].sort((a, b) => a.start_at.localeCompare(b.start_at)).map((event) => <View key={'key' in event ? event.key : event.id} style={styles.calendar}>
          <Text style={styles.label}>{event.title}</Text>
          <Text style={styles.copy}>{time(event)} · {'source_label' in event ? event.source_label : event.external ? 'Connected cloud calendar' : 'Anastasis'}</Text>
          {'calendarId' in event && event.writable ? <View style={styles.actions}>
            {event.recurring ? <AOSButton variant="secondary" disabled={working} onPress={() => { void run(() => editDeviceRecurringEvent(event)) }}>Edit recurring event in calendar</AOSButton> : <>
              <AOSButton variant="secondary" disabled={working} onPress={() => chooseEvent(event)}>Edit</AOSButton>
              <AOSButton variant="danger" disabled={working} onPress={() => confirmDelete(event)}>Delete</AOSButton>
            </>}
          </View> : null}
        </View>)}
        {!events.length && !schedule.length ? <Text style={styles.copy}>No commitments in the selected calendars today.</Text> : null}
      </AOSCard>

      {preferences?.connected ? <>
        <AOSCard>
          <Text style={styles.title}>Find time for an activity</Text>
          <Text style={styles.copy}>These openings use selected device commitments and your Anastasis schedule, in this device’s time zone. Review before saving.</Text>
          <Field label="Duration (minutes)" value={duration} onChange={setDuration} />
          <Field label="Preferred start hour (0–23)" value={String(preferences.hours.start)} onChange={(value) => { void changePreferences({ hours: { ...preferences.hours, start: Number(value) } }) }} />
          <Field label="Preferred end hour (1–24)" value={String(preferences.hours.end)} onChange={(value) => { void changePreferences({ hours: { ...preferences.hours, end: Number(value) } }) }} />
          <Field label="Buffer around commitments (minutes)" value={String(preferences.hours.bufferMinutes)} onChange={(value) => { void changePreferences({ hours: { ...preferences.hours, bufferMinutes: Number(value) } }) }} />
          <View style={styles.actions}>{slots.map((slot) => <AOSButton key={slot.start_at} variant="secondary" onPress={() => {
            const next = freshDraft(); setEditing(null); setDraft({ ...next, start: wallDateTime(new Date(slot.start_at), next.timezone), end: wallDateTime(new Date(slot.end_at), next.timezone), title: 'Personal time' })
          }}>{time(slot)} · Review slot</AOSButton>)}</View>
          {!slots.length ? <Text style={styles.copy}>No suitable openings today within these preferred hours.</Text> : null}
        </AOSCard>
        <AOSCard>
          <Text style={styles.title}>{editing ? 'Edit appointment' : 'Add an event'}</Text>
          <Text style={styles.copy}>Activity labels are general by default. Include only details you want in your calendar.</Text>
          {!editing ? <View style={styles.actions}>{['Personal time', 'Workout', 'Meal prep', 'Recovery'].map((title) => <AOSButton key={title} variant="secondary" onPress={() => setDraft({ ...draft, title })}>{title}</AOSButton>)}</View> : null}
          <Field label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} />
          <Field label="Start date (YYYY-MM-DD)" value={draft.start.split('T')[0]} onChange={(value) => setDraft({ ...draft, start: draft.allDay ? value : `${value}T${draft.start.split('T')[1] || '09:00'}` })} />
          {!draft.allDay ? <Field label="Start time (HH:mm)" value={draft.start.split('T')[1] || ''} onChange={(value) => setDraft({ ...draft, start: `${draft.start.split('T')[0]}T${value}` })} /> : null}
          <Field label={draft.allDay ? 'End date, exclusive (YYYY-MM-DD)' : 'End date (YYYY-MM-DD)'} value={draft.end.split('T')[0]} onChange={(value) => setDraft({ ...draft, end: draft.allDay ? value : `${value}T${draft.end.split('T')[1] || '09:30'}` })} />
          {!draft.allDay ? <Field label="End time (HH:mm)" value={draft.end.split('T')[1] || ''} onChange={(value) => setDraft({ ...draft, end: `${draft.end.split('T')[0]}T${value}` })} /> : null}
          <Field label="Time zone (IANA)" value={draft.timezone} onChange={(timezone) => setDraft({ ...draft, timezone })} />
          <View style={styles.row}><Text style={styles.label}>All day</Text><Switch value={draft.allDay} onValueChange={(allDay) => {
            if (allDay) {
              const start = draft.start.split('T')[0]
              const endDate = new Date(`${start}T12:00:00Z`); endDate.setUTCDate(endDate.getUTCDate() + 1)
              setDraft({ ...draft, allDay, start, end: endDate.toISOString().slice(0, 10) })
            } else setDraft({ ...freshDraft(), title: draft.title, location: draft.location, notes: draft.notes })
          }} /></View>
          <Field label="Location (optional)" value={draft.location} onChange={(location) => setDraft({ ...draft, location })} />
          <Field label="Notes (optional, saved externally)" value={draft.notes} onChange={(notes) => setDraft({ ...draft, notes })} />
          <Field label="Reminder minutes before (blank for none)" value={draft.reminderMinutes == null ? '' : String(draft.reminderMinutes)} onChange={(value) => setDraft({ ...draft, preserveAlarms: undefined, reminderMinutes: value === '' ? null : Number(value) })} />
          {!editing ? <>
            <Text style={styles.label}>Repeat</Text><View style={styles.actions}>{(['none', 'daily', 'weekly', 'monthly'] as const).map((recurrence) => <AOSButton key={recurrence} variant="secondary" onPress={() => setDraft({ ...draft, recurrence })}>{draft.recurrence === recurrence ? '✓ ' : ''}{recurrence}</AOSButton>)}</View>
            {draft.recurrence !== 'none' ? <Field label="Number of occurrences (2–365)" value={String(draft.occurrences)} onChange={(value) => setDraft({ ...draft, occurrences: Number(value) })} /> : null}
            <Text style={styles.label}>Destination</Text><View style={styles.actions}>{(snapshot?.calendars || []).filter((calendar) => calendar.writable).map((calendar) => <AOSButton key={calendar.id} variant="secondary" onPress={() => setDestination(calendar.id)}>{destination === calendar.id ? '✓ ' : ''}{calendar.title}</AOSButton>)}</View>
          </> : null}
          <View style={styles.actions}><AOSButton disabled={working || !destination} onPress={confirmSave}>{working ? 'Saving' : editing ? 'Review update' : 'Review event'}</AOSButton>
            <AOSButton variant="secondary" onPress={() => { setEditing(null); setDraft(freshDraft()); setRequestId(`${Date.now()}-${Math.random().toString(36).slice(2)}`) }}>Start new event</AOSButton>
          </View>
        </AOSCard>
      </> : null}
    </AppShell>
  )
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" style={styles.input} value={value} onChangeText={onChange} /></View>
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 21, fontFamily: 'Georgia' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  error: { color: '#FFB4A3', fontSize: 13, marginTop: 12 },
  actions: { gap: 10, marginTop: 16 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 }, calendar: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  field: { gap: 8, marginTop: 16 }, input: { color: colors.text, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: 10, padding: 12 },
  option: { minHeight: 44, justifyContent: 'center' },
})
