'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { announceCalendarChange, calendarRequest, useCalendarEvents, type CalendarSettings, type UnifiedCalendarEvent } from '@/lib/calendar/client'
import { dateTimeInZone, eventPayloadFromDraft, type CalendarEventDraft } from '@/lib/calendar/form'
import { addLocalDays } from '@/lib/timezone'
import { formatLocalTime, zonedDateTimeToUtc } from '@/lib/schedule/time'
import styles from './calendar.module.css'
import workspaceStyles from './calendar-workspace.module.css'

type AvailableWindow = { start_at: string; end_at: string; minutes: number }

function newDraft(date: string, timezone: string): CalendarEventDraft {
  return { title: '', event_type: 'personal', calendar_id: '', start_date: date, end_date: date, start_time: '09:00', end_time: '09:30', timezone, all_day: false, location: '', description: '', repeat: 'none', recurrence_text: '', repeat_count: '12', reminder: '' }
}
function isRecurring(event: UnifiedCalendarEvent) { return Boolean(event.recurrence?.length || event.recurring_event_id) }
function rangeLabel(event: UnifiedCalendarEvent, timezone: string) {
  if (event.all_day) return `${event.start_date || dateTimeInZone(event.start_at, event.timezone).date} · All day`
  return `${formatLocalTime(event.start_at, timezone)}–${formatLocalTime(event.end_at, timezone)}`
}
function occurrenceKey(event: UnifiedCalendarEvent) { return `${event.id}:${event.occurrence_start || event.start_at}` }

export default function CalendarWorkspace({ date: initialDate, timezone: initialTimezone }: { date: string; timezone: string }) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [timezone, setTimezone] = useState(initialTimezone)
  const start = zonedDateTimeToUtc(date, '00:00', timezone).toISOString()
  const end = zonedDateTimeToUtc(addLocalDays(date, 1), '00:00', timezone).toISOString()
  const { events, calendars, loading, error: loadError, refresh } = useCalendarEvents(start, end, timezone)
  const eventAnchors = useMemo(() => {
    const anchors = new Map<string, string>()
    for (const event of events) if (!anchors.has(event.id)) anchors.set(event.id, occurrenceKey(event))
    return anchors
  }, [events])
  const [draft, setDraft] = useState(() => newDraft(initialDate, initialTimezone))
  const [editing, setEditing] = useState<UnifiedCalendarEvent | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleting, setDeleting] = useState<UnifiedCalendarEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [duration, setDuration] = useState(30)
  const [suggestionType, setSuggestionType] = useState('workout')
  const [windows, setWindows] = useState<AvailableWindow[]>([])
  const [availabilityTimezone, setAvailabilityTimezone] = useState(initialTimezone)
  const [finding, setFinding] = useState(false)
  const [searched, setSearched] = useState(false)
  const [chosen, setChosen] = useState<AvailableWindow | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [defaultCalendar, setDefaultCalendar] = useState('')
  const [googleCalendarIds, setGoogleCalendarIds] = useState<string[]>([])
  const idempotencyKey = useRef<string | null>(null)
  const deletionKey = useRef<string | null>(null)
  const submitLock = useRef(false)
  const availabilityRequest = useRef(0)
  const editor = useRef<HTMLDialogElement>(null)
  const resetDraft = useCallback(() => {
    setDraft({ ...newDraft(date, timezone), calendar_id: defaultCalendar }); setEditing(null); setChosen(null); setHasDraft(false); idempotencyKey.current = null
  }, [date, timezone, defaultCalendar])

  useEffect(() => { let active = true; void calendarRequest<CalendarSettings>('/api/calendars').then(settings => {
    if (!active) return
    setDefaultCalendar(settings.preferences.default_calendar_id || '')
    setGoogleCalendarIds(settings.connections.filter(connection => connection.provider === 'google').flatMap(connection => connection.calendars.map(calendar => calendar.id)))
    setDraft(current => ({ ...current, calendar_id: settings.preferences.default_calendar_id || '' }))
    setTimezone(settings.preferences.timezone || initialTimezone)
    setDraft(current => ({ ...current, timezone: settings.preferences.timezone || initialTimezone }))
  }).catch(() => { /* The event list reports connection errors; internal event creation stays available. */ }); return () => { active = false } }, [initialTimezone])
  useEffect(() => { availabilityRequest.current++; setChosen(null); setWindows([]); setSearched(false) }, [date, duration, suggestionType])
  useEffect(() => {
    const dialog = editor.current
    if (editorOpen && dialog && !dialog.open) dialog.showModal()
    else if (!editorOpen && dialog?.open) dialog.close()
  }, [editorOpen])
  useEffect(() => {
    function onBack() {
      if (window.history.state?.anastasisCalendarEditor) return
      resetDraft(); setEditorOpen(false); setError('')
    }
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [resetDraft])

  function updateDraft(patch: Partial<CalendarEventDraft>) {
    idempotencyKey.current = null
    setDraft(current => ({ ...current, ...patch })); setHasDraft(true); setError(''); setNotice('')
  }
  function selectDate(nextDate: string) {
    if (!nextDate) return
    setDate(nextDate); setDeleting(null); deletionKey.current = null
    if (!hasDraft && !editing && !chosen) setDraft(current => ({ ...current, start_date: nextDate, end_date: nextDate }))
  }
  function openEditor() {
    if (!editorOpen) window.history.pushState({ ...window.history.state, anastasisCalendarEditor: true }, '', '#calendar-event-form')
    setEditorOpen(true)
  }
  function closeEditor() {
    if (submitLock.current) return
    resetDraft(); setEditorOpen(false); setError('')
    if (window.history.state?.anastasisCalendarEditor) window.history.back()
  }
  function editEvent(event: UnifiedCalendarEvent) {
    if (!event.writable) return
    const starts = dateTimeInZone(event.series_start_at || event.start_at, event.timezone)
    const ends = dateTimeInZone(event.series_end_at || event.end_at, event.timezone)
    setDraft({ title: event.title, event_type: event.event_type || 'personal', calendar_id: event.calendar_id || '', start_date: event.all_day ? event.series_start_date || event.start_date || starts.date : starts.date, end_date: event.all_day ? addLocalDays(event.series_end_date || event.end_date || ends.date, -1) : ends.date, start_time: starts.time, end_time: ends.time, timezone: event.timezone, all_day: event.all_day, location: event.location || '', description: event.description || '', repeat: event.recurrence?.length ? 'custom' : 'none', recurrence_text: (event.recurrence || []).join('\n'), repeat_count: '12', reminder: event.reminders_default ? 'default' : (event.reminders || []).join(',') })
    setEditing(event); setDeleting(null); setError(''); setNotice(''); setHasDraft(true); setChosen(null); idempotencyKey.current = null
    openEditor()
  }

  async function saveEvent(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (submitLock.current || !editorOpen || (editing && !editing.writable)) return
    submitLock.current = true; setSaving(true); setError(''); setNotice('')
    try {
      const payload = eventPayloadFromDraft(draft)
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID()
      await calendarRequest(editing ? `/api/calendars/events/${encodeURIComponent(editing.id)}` : '/api/calendars/events', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...payload, idempotency_key: idempotencyKey.current, ...(editing ? { expected_etag: editing.etag, scope: isRecurring(editing) ? 'series' : 'instance', occurrence_start: editing.occurrence_start } : {}) }) })
      setNotice(draft.calendar_id ? 'Confirmed: the event was saved in your external calendar.' : 'Event saved to your Anastasis calendar.')
      resetDraft(); setEditorOpen(false)
      if (window.history.state?.anastasisCalendarEditor) window.history.back()
      await refresh(); announceCalendarChange(); router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Event could not be saved. Retry to check the same request without duplicating it.')
    } finally { submitLock.current = false; setSaving(false) }
  }
  async function deleteEvent() {
    if (!deleting || submitLock.current) return
    submitLock.current = true; setSaving(true); setError(''); setNotice('')
    try {
      if (!deletionKey.current) deletionKey.current = crypto.randomUUID()
      await calendarRequest(`/api/calendars/events/${encodeURIComponent(deleting.id)}`, { method: 'DELETE', body: JSON.stringify({ expected_etag: deleting.etag, idempotency_key: deletionKey.current, scope: isRecurring(deleting) ? 'series' : 'instance', occurrence_start: deleting.occurrence_start }) })
      setDeleting(null); setNotice('Deletion confirmed.'); if (editing?.id === deleting.id) resetDraft()
      await refresh(); announceCalendarChange(); router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Event could not be deleted.') }
    finally { submitLock.current = false; setSaving(false) }
  }
  async function findOpenings() {
    const current = ++availabilityRequest.current
    setFinding(true); setError(''); setChosen(null)
    try {
      const result = await calendarRequest<{ windows: AvailableWindow[]; timezone: string }>(`/api/calendars/availability?${new URLSearchParams({ date, duration: String(duration) })}`)
      if (current === availabilityRequest.current) { setWindows(result.windows); setAvailabilityTimezone(result.timezone); setSearched(true) }
    } catch (caught) { if (current === availabilityRequest.current) setError(caught instanceof Error ? caught.message : 'Availability could not be checked.') }
    finally { setFinding(false) }
  }
  async function refreshProviders() {
    if (syncing) return
    setSyncing(true); setError(''); setNotice('')
    try {
      const settings = await calendarRequest<CalendarSettings>('/api/calendars')
      const errors: string[] = []
      for (const connection of settings.connections) {
        try { await calendarRequest(`/api/calendars/${encodeURIComponent(connection.id)}/sync`, { method: 'POST' }) }
        catch (caught) { errors.push(`${connection.account_label}: ${caught instanceof Error ? caught.message : 'Sync failed. Reconnect or retry.'}`) }
      }
      await refresh(); announceCalendarChange(); router.refresh(); setWindows([]); setSearched(false); setChosen(null)
      if (errors.length) setError(errors.join(' '))
      else setNotice('Calendar refresh completed. The latest appointments are shown below.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Calendars could not be refreshed.') }
    finally { setSyncing(false) }
  }
  function chooseOpening(window: AvailableWindow) {
    const starts = dateTimeInZone(window.start_at, availabilityTimezone)
    const ends = dateTimeInZone(new Date(new Date(window.start_at).getTime() + duration * 60000).toISOString(), availabilityTimezone)
    setEditing(null); setChosen(window); setHasDraft(true); idempotencyKey.current = null
    setDraft({ ...newDraft(starts.date, availabilityTimezone), calendar_id: defaultCalendar, title: 'Anastasis activity', event_type: suggestionType, start_time: starts.time, end_time: ends.time, end_date: ends.date })
    openEditor()
  }
  const writable = calendars.filter(calendar => calendar.writable && calendar.selected)
  const canEditDates = !editing || !isRecurring(editing) || Boolean(editing.series_start_at)

  return <section className={styles.section} aria-label="Unified calendar" id="connected-calendar">
    <div className={styles.heading}><div><h2>Your calendars together</h2><p>Appointments from selected accounts and events you schedule in Anastasis.</p></div><div className={styles.actions}><Link href={`/dashboard/schedule?date=${date}`} className={styles.link}>Schedule</Link><Link href="/dashboard/settings/calendars" className={styles.link}>Connected calendars</Link><button type="button" disabled={syncing || saving} onClick={() => void refreshProviders()}>{syncing ? 'Refreshing calendars…' : 'Refresh calendars'}</button><button type="button" aria-label="Add event" aria-haspopup="dialog" aria-controls="calendar-event-form" aria-expanded={editorOpen} disabled={saving} onClick={() => { resetDraft(); setError(''); setNotice(''); openEditor() }}><span aria-hidden="true">＋</span> Add event</button></div></div>
    <div className={styles.form}><label>View date<input type="date" value={date} required onChange={event => selectDate(event.target.value)} /></label></div>
    <p className={styles.muted}>Times shown in {timezone}. Existing appointments stay in place; suggested activities require your confirmation.</p>
    {loadError ? <p role="alert" className={styles.error}>{loadError}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {notice ? <p role="status" className={styles.success}>{notice}</p> : null}
    <div>
      {loading ? <p role="status">Loading events…</p> : null}
      <ul className={styles.events}>{events.map(event => <li key={occurrenceKey(event)} id={eventAnchors.get(event.id) === occurrenceKey(event) ? `calendar-event-${event.id}` : undefined} className={styles.event}>
        <span className={styles.badge}>{event.source_label || (event.calendar_id ? 'Connected calendar' : 'Anastasis')}</span>{!event.writable ? <> <span className={styles.badge}>Read only</span></> : null}
        <h3>{event.title}</h3><time>{rangeLabel(event, timezone)}</time>{event.location ? <p>{event.location}</p> : null}{isRecurring(event) ? <small>Repeating event · changes apply to the entire series</small> : null}
        {event.writable ? <div className={styles.actions}><button type="button" onClick={() => editEvent(event)} disabled={saving}>Edit{isRecurring(event) ? ' series' : ''}</button><button type="button" className={styles.danger} disabled={saving} onClick={() => { deletionKey.current = null; setDeleting(event); setError('') }}>Delete{isRecurring(event) ? ' series' : ''}</button></div> : null}
      </li>)}</ul>
      {!loading && !events.length ? <p className={styles.muted}>No saved appointments on this day.</p> : null}
      {deleting ? <div className={styles.confirmation} role="group" aria-label="Confirm event deletion"><p>Delete “{deleting.title}”{isRecurring(deleting) ? ' and all events in its repeating series' : ''}{deleting.calendar_id ? ' from the external calendar' : ' from Anastasis'}? This action removes the event.</p><div className={styles.actions}><button type="button" className={styles.danger} disabled={saving} onClick={() => void deleteEvent()}>Confirm deletion</button><button type="button" disabled={saving} onClick={() => setDeleting(null)}>Keep event</button></div></div> : null}
      <details><summary>Find time for an Anastasis activity</summary><div className={styles.form}><label>Activity<select value={suggestionType} onChange={event => setSuggestionType(event.target.value)}><option value="workout">Workout</option><option value="meal">Meal prep</option><option value="recovery">Recovery</option><option value="custom">Personal activity</option></select></label><label>Duration (minutes)<input type="number" min="5" max="240" step="5" value={duration} onChange={event => setDuration(Number(event.target.value))} /></label><button type="button" disabled={finding || duration < 5 || duration > 240} onClick={() => void findOpenings()}>{finding ? 'Checking busy times…' : 'Find available time'}</button></div><p className={styles.muted}>Uses busy times, your preferred hours, and your buffer settings. Appointment details are not needed for these suggestions.</p><div className={styles.slots}>{windows.slice(0, 8).map(window => <div className={styles.slot} key={window.start_at}><span>{formatLocalTime(window.start_at, availabilityTimezone)}–{formatLocalTime(window.end_at, availabilityTimezone)} · {window.minutes} free minutes</span><button type="button" onClick={() => chooseOpening(window)} disabled={saving}>Review this time</button></div>)}</div>{searched && !windows.length ? <p className={styles.muted}>No opening fits that duration in your preferred hours. Try a shorter activity or another date.</p> : null}</details>
    </div><dialog ref={editor} id="calendar-event-form" className={`${styles.section} ${workspaceStyles.editor}`} aria-labelledby="calendar-event-editor-title" onCancel={event => { event.preventDefault(); closeEditor() }}>
      {editorOpen ? <><h3 id="calendar-event-editor-title">{editing ? `Edit ${isRecurring(editing) ? 'entire series' : 'event'}` : 'Add an event'}</h3>
      {chosen ? <p className={styles.note}>Review the suggested time and destination, then confirm below to add this activity. Nothing has been added yet.</p> : null}
      {editing && isRecurring(editing) ? <p className={styles.note}>Saving updates the entire repeating series. Individual occurrence changes are currently managed in the calendar provider.</p> : null}
      {editing?.legacy ? <p className={styles.note}>This is an existing internal schedule event. To add a location, reminders, or repetition, create a new calendar event.</p> : null}
      {!canEditDates ? <p className={styles.note}>Series timing could not be loaded. Edit date and time in your calendar provider.</p> : null}
      <form className={styles.form} onSubmit={saveEvent}>
        <label>Title<input autoFocus required maxLength={200} value={draft.title} onChange={event => updateDraft({ title: event.target.value })} /></label>
        <div className={styles.fields}><label>Type<select value={draft.event_type} disabled={Boolean(editing?.legacy)} onChange={event => updateDraft({ event_type: event.target.value })}>{['personal','workout','meal','recovery','check_in','assessment','work','school','appointment','household','custom','medical','dental','hydration','sleep'].map(type => <option key={type} value={type}>{type === 'meal' ? 'Meal prep' : type.replaceAll('_', ' ')}</option>)}</select></label><label>Destination calendar<select value={draft.calendar_id} disabled={Boolean(editing)} onChange={event => updateDraft({ calendar_id: event.target.value, ...(event.target.value && draft.event_type !== 'personal' && draft.event_type !== 'custom' ? { title: 'Anastasis activity', description: '' } : {}) })}><option value="">Anastasis calendar</option>{writable.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}{editing?.calendar_id && !writable.some(calendar => calendar.id === editing.calendar_id) ? <option value={editing.calendar_id}>{editing.source_label}</option> : null}</select></label></div>
        {draft.calendar_id ? <p className={styles.note}>External calendars may be shared. Keep titles and notes general; health, symptom, cycle, and nutrition details are not included automatically.</p> : null}
        <label className={styles.check}><input type="checkbox" checked={draft.all_day} disabled={!canEditDates} onChange={event => updateDraft({ all_day: event.target.checked })} />All-day event</label>
        <div className={styles.fields}><label>{draft.all_day ? 'First day' : 'Start date'}<input type="date" required value={draft.start_date} disabled={!canEditDates} onChange={event => updateDraft({ start_date: event.target.value })} /></label><label>{draft.all_day ? 'Last day (included)' : 'End date'}<input type="date" required value={draft.end_date} disabled={!canEditDates} onChange={event => updateDraft({ end_date: event.target.value })} /></label></div>
        {!draft.all_day ? <div className={styles.fields}><label>Start time<input type="time" required value={draft.start_time} disabled={!canEditDates} onChange={event => updateDraft({ start_time: event.target.value })} /></label><label>End time<input type="time" required value={draft.end_time} disabled={!canEditDates} onChange={event => updateDraft({ end_time: event.target.value })} /></label></div> : null}
        <label>Time zone<input required value={draft.timezone} disabled={!canEditDates} placeholder="America/Chicago" onChange={event => updateDraft({ timezone: event.target.value })} /></label>
        <label>Location (optional)<input maxLength={500} value={draft.location} disabled={Boolean(editing?.legacy)} onChange={event => updateDraft({ location: event.target.value })} /></label><label>Notes (optional)<textarea maxLength={5000} value={draft.description} onChange={event => updateDraft({ description: event.target.value })} /></label>
        <div className={styles.fields}><label>Repeat<select value={draft.repeat} disabled={Boolean(editing?.legacy)} onChange={event => updateDraft({ repeat: event.target.value })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom recurrence rule</option></select></label><label>Reminder<select value={draft.reminder} disabled={Boolean(editing?.legacy)} onChange={event => updateDraft({ reminder: event.target.value })}><option value="">No reminder</option>{googleCalendarIds.includes(draft.calendar_id) || editing?.calendar_provider === 'google' || draft.reminder === 'default' ? <option value="default">Calendar default reminders</option> : null}{draft.reminder && !['default','0','5','10','15','30','60','1440'].includes(draft.reminder) ? <option value={draft.reminder}>Existing reminders ({draft.reminder} minutes before)</option> : null}{[0,5,10,15,30,60,1440].map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? 'At start' : minutes === 1440 ? '1 day before' : `${minutes} minutes before`}</option>)}</select></label></div>
        {draft.repeat === 'custom' ? <label>Recurrence rules<textarea value={draft.recurrence_text} placeholder="RRULE:FREQ=WEEKLY;COUNT=12" onChange={event => updateDraft({ recurrence_text: event.target.value })} required /></label> : draft.repeat !== 'none' ? <label>Number of occurrences<input type="number" min="2" max="500" value={draft.repeat_count} required onChange={event => updateDraft({ repeat_count: event.target.value })} /></label> : null}
        <p className={styles.muted}>Reminder delivery depends on the destination calendar. Internal reminders are saved here; scheduled delivery is not enabled.</p>
        <div className={styles.actions}><button className={styles.primary} type="submit" disabled={saving || (editing !== null && !canEditDates)}>{saving ? 'Confirming with calendar…' : editing ? `Confirm ${isRecurring(editing) ? 'series ' : ''}changes` : chosen ? 'Confirm and add activity' : 'Add event'}</button><button type="button" disabled={saving} onClick={closeEditor}>Cancel</button></div>
      </form>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </> : null}
    </dialog>
  </section>
}
