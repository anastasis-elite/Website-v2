# Connected calendars

Calendar connections are separate from Anastasis authentication. Linking Google or iCloud never signs the user into Anastasis as a different account. Existing program entitlements and Ember nutrition access remain unchanged. Meal prep is a scheduling category; this feature does not add meal logging.

## Repository inventory

- Next.js 15 App Router website, Supabase SSR cookies, mobile bearer sessions, and `clients.auth_user_id` ownership.
- Existing internal table `anastasis_schedule_events`, daily scheduling engine, recurring daily-structure commitments, open-window/conflict checks, dashboard day/week/month calendar, and What’s Next.
- Existing external-event ID fields were placeholders; there were no calendar-provider authorizations or synchronization adapters.
- Expo SDK 57 native application under `anastasis-mobile`; platform health integrations and authentication already existed.
- Existing TikTok OAuth/encryption is unrelated to client calendar linking. This implementation uses separate credentials, OAuth state, and encryption keys.

## Implemented web behavior

**Google:** separate OAuth authorization with state, S256 PKCE, an HttpOnly same-site browser cookie, verified Anastasis session binding, and single-use expiring server state. Offline refresh tokens and stable Google account identity are encrypted server-side. Calendar discovery includes ACL-based write permissions. Event reads store recurring masters, detached exceptions, and cancellations; incremental tokens are checkpointed after successful paginated persistence. Invalid tokens trigger a replacement full synchronization. Create uses deterministic IDs and private operation markers; PATCH uses ETags and an update operation marker; DELETE accepts already-absent events on retries. Keyed edit retries read back the current provider version, acknowledging previously completed writes without overwriting later provider changes.

**iCloud:** authenticated CalDAV discovery through current-user-principal and calendar-home-set; selected calendar read/write privileges; standard DAV synchronization when supported, and full snapshots otherwise. Only HTTPS Apple CalDAV hosts and validated redirects/hrefs are accepted. Password format is limited to generated Apple app-specific passwords. Credentials are AES-256-GCM encrypted, authenticated against the owning user and connection. Creation uses deterministic resource URLs and conditional PUT; edits/deletes use ETags. The iCalendar parser handles all-day exclusive dates, recurrence exceptions, cancellations, and IANA/embedded time zones. Authoring includes VTIMEZONE, location, notes, display alarms, and recurrence rules. Existing attendee data and detached exceptions are preserved when editing a series.

**Internal calendar:** works without linking an external account after the additive migration and existing server configuration are deployed. New events support dates, times, time zones, all-day dates, location, notes, recurrence and stored reminder settings. Internal reminder delivery is not enabled. Existing internal events retain their original activity-completion workflows. Imported commitments feed the daily schedule, Coming up, and relevant What’s Next views with source labels; generic scheduling guidance uses busy intervals rather than appointment notes.

**Settings:** `/dashboard/settings/calendars`, accessible from Schedule, dashboard Calendar, and Account. Connect, choose read calendars, set a selected writable default, inspect status/last sync/actionable errors, refresh, reconnect, disconnect, preferred hours, time zone and buffers. New events are displayed as externally synced only after provider success. Availability suggestions require review and confirmation. Suggested activity titles default to “Anastasis activity” for external destinations; health/cycle/symptom/nutrition details are never automatically copied.

**Native iOS / Android:** the existing Expo SDK 57 app now uses `expo-calendar ~57.0.3` with full calendar permission requested explicitly. `/calendar` and Profile provide device calendar selection, writable defaults, status, refresh/reconnect/disconnect, confirmed device-store creation, explicit edits/deletion, reminders, recurrence creation and system editing of repeating events. Device appointments feed Today and current-commitment guidance; busy intervals and preferred hours drive confirmed scheduling suggestions. Device details stay on the device, and preferences/write mappings are scoped to the signed-in Anastasis user. An explicit mapping identifies the same calendar exposed through both cloud and device access so it is displayed once; title/time guesses are avoided. Refresh occurs on screen focus, app foreground and calendar changes inside Anastasis. Native permission is separate from iCloud CalDAV and Google cloud authorization. A device-store success does not guarantee the account's cloud upload has completed. See `anastasis-mobile/CALENDAR_INTEGRATION.md` for build instructions, background limits, crash reconciliation and verification status.

## Deployment and exact environment variables

Use the existing Supabase project; do not apply migrations to an unrelated production project. Review and apply **only** the additive migration `supabase/migrations/20261011210620_connected_calendars.sql` through your established reviewed migration process. It adds seven tables and two service-only invoker functions; it does not alter existing tables or subscription access. Local tests execute this migration in PostgreSQL and verify RLS/permissions. A real deployment migration and Supabase advisors have not been run without an authorized target.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Existing public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing public/publishable client key |
| `SUPABASE_SECRET_KEY` | Existing server-only Supabase secret; preferred |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing legacy server-only alternative to `SUPABASE_SECRET_KEY` |
| `GOOGLE_CALENDAR_CLIENT_ID` | Google OAuth Web application client ID |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Its server-only client secret |
| `GOOGLE_CALENDAR_REDIRECT_URI` | Exact registered redirect URI below |
| `CALENDAR_CREDENTIAL_ENCRYPTION_KEY` | Base64-encoded 32 random bytes; server-only; back up securely |
| `CRON_SECRET` | Strong random server-only secret for authenticated background refresh |

Generate encryption material with `openssl rand -base64 32` and place it directly in your secret manager. Do not commit, print to application logs, put into analytics, or prefix private values with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. Changing the encryption key requires a controlled re-encryption process or reconnecting every account; losing it makes stored credentials unusable.

For the repository’s canonical production domain, register and configure exactly:

```
https://anastasiselite.com/api/calendars/google/callback
```

If deployed under `www`, register and configure exactly:

```
https://www.anastasiselite.com/api/calendars/google/callback
```

For local development on port 3000:

```
http://localhost:3000/api/calendars/google/callback
```

The configured URI must match the host used to start linking, so the browser’s state cookie and Anastasis session reach the callback. Register preview URLs separately, with preview credentials and a test database. This callback is a calendar-linking route, not a Supabase login redirect. There is no Apple OAuth callback or Android cloud callback.

## Google provider setup and verification

1. Enable Google Calendar API in the Google Cloud project.
2. Create a dedicated **Web application** OAuth client for calendar linking, separate from any Supabase Google login client; add the exact redirect URIs above.
3. Configure consent branding, authorized domains, support/developer contacts, home page, privacy policy and terms. Domain ownership and policy content must accurately describe calendar access, retention, and revocation.
4. Declare exactly these scopes:
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/userinfo.email`
5. For development, use External / Testing and explicitly add authorized Google test users. Testing refresh tokens for these scopes expire after seven days; reconnect is then expected.
6. For public launch, complete applicable brand/sensitive-scope verification in Google’s Verification Center. Provide least-privilege justification and an unlisted demonstration of account linking, calendar selection, event reads and explicit create/edit/delete. Workspace administrators may restrict consent. Verification approval has not been requested or obtained by this change.

Official documentation: [OAuth web servers](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync), [sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

## iCloud customer setup

Enable two-factor authentication on the Apple Account. At [account.apple.com](https://account.apple.com), open **Sign-In and Security → App-Specific Passwords → Generate an app-specific password**, name it Anastasis, and enter that generated password and Apple Account email in Connected calendars. Never enter the primary Apple Account password. The server authenticates against `https://caldav.icloud.com/`, discovers the account’s actual calendar hosts, and stores the generated credential encrypted. No iCloud password goes into environment variables.

If revoked, regenerate the app-specific password and reconnect. Disconnect removes Anastasis’s stored credential; also revoke the app-specific password in the Apple Account dashboard if desired. Ordinary Sign in with Apple does not authorize calendar access. [Apple’s app-specific password instructions](https://support.apple.com/en-us/102654), [CalDAV standard](https://www.rfc-editor.org/rfc/rfc4791), [DAV synchronization](https://www.rfc-editor.org/rfc/rfc6578).

## Background processing, conflicts and retention

`vercel.json` schedules `GET /api/calendars/cron` every 15 minutes. Configure `CRON_SECRET`; Vercel sends `Authorization: Bearer <CRON_SECRET>`. This schedule needs a Vercel plan supporting subdaily cron (typically Pro), or an external scheduler calling the same endpoint with that header. Do not rely on a browser tab or a process-local timer. Vercel Hobby daily-only cron cannot run this schedule. The worker processes up to ten due connections per invocation in due-time order; larger installations need increased scheduler frequency/worker capacity. Inspect aggregate worker success/failure responses and connection statuses without recording event text or credentials.

An atomic per-connection lease serializes refresh and explicit cloud writes. Leases expire after four minutes and are renewed before persistence; route maximum duration is 180 seconds. Failed refreshes retain the prior snapshot, leave the cursor unadvanced, record sanitized actionable status, and schedule exponential retries honoring provider Retry-After. Revoked connections stop background access until reconnected. Manual Refresh calendars reads providers again.

Conflicts are explicit: cached and provider ETags must match for a fresh edit/delete. A newer provider version produces HTTP 409 and asks the user to refresh and review. Recurring event operations currently apply to the **entire series**, with explicit UI confirmation. Individual occurrence changes made in the provider are read correctly, but occurrence-only authoring remains in the provider. No appointments are automatically moved or overwritten.

The selected cloud calendar’s normalized masters/exceptions are retained while selected and connected, including historical masters required for recurrence. UI reads are bounded to the requested period. Deselecting immediately clears that calendar’s imported data. Disconnect atomically removes the connection, encrypted credentials, calendar metadata, imports, and connection-linked write records; the default calendar becomes null. It never deletes external events. An already-issued provider request can finish during a simultaneous disconnect, but foreign-key ownership/lease checks prevent new imported rows after removal. Internal events stay in Anastasis. Minimal internal idempotency records contain request hashes and IDs/success flags, not tokens or event notes, and are retained until account deletion to prevent delayed duplicate retries.

## Customer walkthrough

1. Open **Schedule → Connected calendars** (or **Account → Connected calendars**).
2. Connect Google, or use the Apple app-specific-password steps for iCloud.
3. Select the calendars Anastasis may read and save. Choose a writable default. Existing appointments appear with Google/iCloud source labels.
4. Open Schedule, choose an event type, date/time or all-day dates, time zone, optional notes/location/reminders and destination. Click **Add event** and wait for provider confirmation.
5. Open **Find a time**, choose activity/duration, review an opening based on preferred hours and busy commitments, then **Confirm and add activity**.
6. Use **Refresh calendars** after an external change. Edit/delete explicitly; repeating events state the entire-series scope. Deletion requires a second confirmation.
7. Disconnect in settings whenever desired; outside calendar events remain untouched.

## Verification status and launch checklist

Automated provider tests use mocked HTTP responses; API/service flow tests use mocked provider transports and a Supabase query/RPC test double. The actual additive migration and row-level-security checks run in a local PostgreSQL engine (PGlite). Date/recurrence tests exercise daylight saving, all-day exclusivity, exceptions, and extreme viewer time zones. Existing dashboard, onboarding, tier boundaries and scheduling tests run with the full repository test suite. These checks are distinct from a live provider or a production database verification.

No real Google/iCloud account, deployed Supabase migration, cron invocation against a deployed database, or physical device provider has been exercised in this workspace. The local environment has no configured Supabase/OAuth/calendar secrets. Complete provider configuration, reviewed migration, consent approval and native builds before claiming production readiness. Use authorized test accounts and separately verify: connect/select/read; create and inspect externally; external edit/cancellation and refresh; explicit edit/delete; permission denial/read-only/revocation/reconnect/disconnect; recurring/all-day events across DST; duplicate retries and two-user isolation. Native details and test status are in `anastasis-mobile/CALENDAR_INTEGRATION.md`.
