'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { announceCalendarChange, calendarRequest, type CalendarConnection, type CalendarPreferences, type CalendarSettings } from '@/lib/calendar/client'
import styles from './calendar.module.css'

const initialPreferences: CalendarPreferences = { default_calendar_id: null, timezone: 'America/Chicago', preferred_start: '07:00', preferred_end: '21:00', buffer_minutes: 10 }

function ConnectionCard({ connection, onRefresh, onReconnect }: { connection: CalendarConnection; onRefresh: () => Promise<void>; onReconnect: (connection: CalendarConnection) => void }) {
  const [selected, setSelected] = useState(connection.calendars.filter(calendar => calendar.selected).map(calendar => calendar.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const lock = useRef(false)
  useEffect(() => { setSelected(connection.calendars.filter(calendar => calendar.selected).map(calendar => calendar.id)) }, [connection.calendars])

  async function run(method: string, suffix = '', body?: unknown) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      await calendarRequest(`/api/calendars/${encodeURIComponent(connection.id)}${suffix}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
      await onRefresh(); announceCalendarChange()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Calendar connection could not be updated.') }
    finally { lock.current = false; setBusy(false) }
  }

  return <article className={styles.account}>
    <div className={styles.heading}>
      <div><h3>{connection.account_label}</h3><span className={styles.badge}>{connection.provider === 'icloud' ? 'iCloud / CalDAV' : 'Google Calendar'} · {connection.status.replaceAll('_', ' ')}</span></div>
      <div className={styles.actions}><button type="button" onClick={() => void run('POST', '/sync')} disabled={busy}>Refresh</button><button type="button" onClick={() => onReconnect(connection)} disabled={busy}>Reconnect</button><button type="button" className={styles.danger} onClick={() => setConfirmDisconnect(true)} disabled={busy}>Disconnect</button></div>
    </div>
    <p className={styles.muted}>{connection.last_synced_at ? `Last successful sync: ${new Date(connection.last_synced_at).toLocaleString()}` : 'A successful sync has not completed yet.'}</p>
    {connection.error_message ? <p role="alert" className={styles.error}>{connection.error_message} Refresh to retry, or reconnect if access was revoked.</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <fieldset disabled={busy}><legend>Calendars Anastasis reads</legend>
      <ul className={styles.calendars}>{connection.calendars.map(calendar => <li key={calendar.id}><label><input type="checkbox" checked={selected.includes(calendar.id)} onChange={event => setSelected(current => event.target.checked ? [...current, calendar.id] : current.filter(id => id !== calendar.id))} />{calendar.name}<span className={styles.badge}>{calendar.writable ? 'Read & write' : 'Read only'}</span></label></li>)}</ul>
      {!connection.calendars.length ? <p className={styles.muted}>No calendars were discovered. Refresh or check the account’s calendar permissions.</p> : null}
      <button type="button" onClick={() => void run('PATCH', '', { selected_calendar_ids: selected })}>Save calendar selection</button>
    </fieldset>
    {confirmDisconnect ? <div className={styles.confirmation} role="group" aria-label="Confirm calendar disconnect"><p>Disconnect {connection.account_label}? This removes stored credentials and imported appointments from Anastasis. Your external events stay in your calendar.</p><div className={styles.actions}><button type="button" className={styles.danger} disabled={busy} onClick={() => void run('DELETE')}>Confirm disconnect</button><button type="button" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Keep connected</button></div></div> : null}
  </article>
}

export default function ConnectedCalendars() {
  const router = useRouter()
  const [settings, setSettings] = useState<CalendarSettings | null>(null)
  const [preferences, setPreferences] = useState(initialPreferences)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showICloud, setShowICloud] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const lock = useRef(false)

  const refresh = useCallback(async () => {
    const next = await calendarRequest<CalendarSettings>('/api/calendars')
    setSettings(next); setPreferences(next.preferences); setLoading(false)
  }, [])
  useEffect(() => { let active = true; void refresh().catch(caught => { if (active) { setError(caught instanceof Error ? caught.message : 'Settings could not be loaded.'); setLoading(false) } }); return () => { active = false } }, [refresh])
  useEffect(() => {
    const result = new URLSearchParams(window.location.search)
    if (result.get('calendar_connected')) setNotice('Calendar account linked. Select the calendars you want Anastasis to read.')
    if (result.get('calendar_error')) setError('Calendar authorization was not completed. Try connecting again and allow the requested calendar access.')
  }, [])

  async function action(work: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await work(); router.refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The connection could not be completed.') }
    finally { lock.current = false; setBusy(false) }
  }
  function connectGoogle() { void action(async () => { const result = await calendarRequest<{ url: string }>('/api/calendars/google/connect', { method: 'POST' }); window.location.assign(result.url) }) }
  function reconnect(connection: CalendarConnection) {
    if (connection.provider === 'google') connectGoogle()
    else { setEmail(connection.account_label); setPassword(''); setShowICloud(true) }
  }
  const writable = settings?.connections.flatMap(connection => connection.calendars.filter(calendar => calendar.writable && calendar.selected)) || []

  return <section className={`${styles.section} phone-app-calendars`} aria-label="Connected calendars">
    <div className={styles.heading}><div><h2>Connected calendars</h2><p>Review your calendar options alongside your Anastasis activities. External connections depend on platform setup and the access you choose to grant.</p></div><Link href="/dashboard/schedule" className={styles.link}>Open calendar</Link></div>
    <p className={styles.note}>Calendar connections are separate from your Anastasis login. Linking another account does not change your login or program access.</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {notice ? <p className={styles.success} role="status">{notice}</p> : null}
    {loading ? <p role="status">Loading calendar settings…</p> : null}
    <div className={styles.actions}><button type="button" disabled={loading || busy || !settings?.google_configured} onClick={connectGoogle}>Connect Google Calendar</button><button type="button" disabled={loading || busy || settings?.icloud_configured !== true} onClick={() => setShowICloud(current => !current)}>Connect iCloud Calendar</button><button type="button" disabled={busy} onClick={() => void action(async () => { await refresh() })}>Reload settings</button></div>
    {settings && !settings.google_configured ? <p className={styles.muted}>Google Calendar connection needs platform setup before you can authorize access.</p> : null}
    {settings?.icloud_configured === false ? <p className={styles.muted}>iCloud connection is awaiting secure server configuration.</p> : null}
    {showICloud ? <div className={styles.account}><h3>Connect your iCloud account</h3><p className={styles.muted}>This connects iCloud calendars through authenticated CalDAV. Calendars stored only on your device are not accessible from this browser.</p><ol className={styles.muted}><li>Enable two-factor authentication on your Apple Account.</li><li>Open <a href="https://account.apple.com/" target="_blank" rel="noopener noreferrer">Apple Account</a>, choose Sign-In and Security → App-Specific Passwords, and generate a password named Anastasis.</li><li>Enter your Apple Account email and that app-specific password below. You can revoke it in Apple Account at any time.</li></ol><p className={styles.note}>Use an app-specific password. Never enter your primary Apple Account password. Credentials are encrypted on the server.</p>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); const credential = password; setPassword(''); void action(async () => { await calendarRequest('/api/calendars/icloud', { method: 'POST', body: JSON.stringify({ email, app_password: credential }) }); await refresh(); announceCalendarChange(); setShowICloud(false); setNotice('iCloud connected. Select the calendars you want to read.') }) }}>
        <label>Apple Account email<input type="email" value={email} autoComplete="username" onChange={event => setEmail(event.target.value)} required disabled={busy} /></label>
        <label>App-specific password<input type="password" value={password} autoComplete="off" onChange={event => setPassword(event.target.value)} required disabled={busy} /></label>
        <div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Connecting…' : 'Connect iCloud'}</button><button type="button" disabled={busy} onClick={() => { setPassword(''); setShowICloud(false) }}>Cancel</button></div>
      </form></div> : null}
    {settings?.connections.map(connection => <ConnectionCard key={connection.id} connection={connection} onRefresh={async () => { await refresh(); router.refresh() }} onReconnect={reconnect} />)}
    {settings && !settings.connections.length ? <p className={styles.muted}>No external accounts are connected. Choose a destination when adding an event and check its save confirmation.</p> : null}
    <details className={styles.account}><summary>Device calendars on iOS and Android</summary><p className={styles.muted}>Check the account behind each calendar. Configured Google and iCloud accounts can connect here. Direct Microsoft/Exchange and other-provider connections are unavailable on this page.</p><p className={styles.muted}>The browser cannot access calendars stored only on your phone. Device calendar access and background sync have not been enabled by these settings.</p></details>
    {settings ? <div className={styles.account}><h3>Scheduling preferences</h3><form className={styles.form} onSubmit={event => { event.preventDefault(); void action(async () => { await calendarRequest('/api/calendars/preferences', { method: 'PATCH', body: JSON.stringify(preferences) }); await refresh(); announceCalendarChange(); setNotice('Calendar preferences saved.') }) }}>
      <label>Default destination for new events<select value={preferences.default_calendar_id || ''} onChange={event => setPreferences(current => ({ ...current, default_calendar_id: event.target.value || null }))}><option value="">Anastasis calendar</option>{writable.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>
      <label>Time zone<input value={preferences.timezone} required placeholder="America/Chicago" onChange={event => setPreferences(current => ({ ...current, timezone: event.target.value }))} /></label>
      <div className={styles.fields}><label>Preferred start<input type="time" value={preferences.preferred_start} required onChange={event => setPreferences(current => ({ ...current, preferred_start: event.target.value }))} /></label><label>Preferred end<input type="time" value={preferences.preferred_end} required onChange={event => setPreferences(current => ({ ...current, preferred_end: event.target.value }))} /></label></div>
      <label>Buffer around busy appointments (minutes)<input type="number" min="0" max="120" value={preferences.buffer_minutes} required onChange={event => setPreferences(current => ({ ...current, buffer_minutes: Number(event.target.value) }))} /></label>
      <button type="submit" disabled={busy}>Save scheduling preferences</button>
    </form></div> : null}
  </section>
}
