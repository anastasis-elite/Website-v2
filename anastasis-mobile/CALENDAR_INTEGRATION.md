# Native connected calendars

The existing Expo SDK 57 app uses `expo-calendar ~57.0.3` and its supported object API. Open **Profile → Connected calendars** or **Today → Calendar**. Google and iCloud cloud account linking opens `/dashboard/settings/calendars` in the browser; sign into the same Anastasis account there. Browser login and calendar linking do not change the app's login.

## Device capabilities

- iOS: explicit full calendar permission reads calendars exposed by EventKit, including local, iCloud and other configured accounts. This permission is separate from server-side iCloud CalDAV authorization.
- Android: explicit `READ_CALENDAR` / `WRITE_CALENDAR` permissions access calendars exposed by the device Calendar Provider. All-day writes use UTC midnight as required by [CalendarContract](https://developer.android.com/reference/android/provider/CalendarContract.Events), then dates are projected to the device's civil day for display and availability. Google-backed accounts can also connect through web Google OAuth. There is no universal Android calendar cloud API.
- Select read calendars and a writable default; inspect status/last successful refresh; refresh, reconnect permission or disconnect. Calendar and exposed meeting restrictions are checked before mutations, with the OS enforcing additional restrictions.
- Read appointments alongside Anastasis activities in Today; show event sources. Current busy device commitments can lead the next action while urgent safety guidance retains priority.
- Create personal events, workouts, meal prep and recovery after confirmation. Dates, chosen IANA time zone, all-day dates, location, notes, optional reminders and daily/weekly/monthly recurrence are supported. Timed DST gaps are rejected; ambiguous fold times use their first occurrence. All-day dates resolve to the first valid civil-day instant.
- Explicitly edit/delete ordinary events with a fresh fingerprint check and deletion confirmation. Existing alarms and availability are retained when unchanged. Repeating-event edits/deletions use the system calendar editor so users choose occurrence/series scope.
- Find openings using selected busy commitments, preferred hours, duration and buffers. Review an opening before adding it. Suggested external activity labels are general; health, symptom, cycle and nutrition details are not copied automatically. Meal prep scheduling does not add Ember meal logging or change entitlements.

## Privacy, duplicates and lifecycle

Device appointment details remain in memory on this device. Preferences and write mappings are stored under the signed-in user's ID. Session changes discard in-flight results; disconnect clears local preferences/write mappings and stops future reads without deleting external appointments. OS permission can also be revoked in Settings.

For a calendar connected through both cloud and device access, explicitly choose its matching cloud calendar in settings. The cloud copy becomes the display source while available; reliable shared remote identifiers are not universally exposed by Expo, so the app does not guess from appointment titles. Configure this mapping to prevent duplicate display. A device write confirms the device store only; OS account upload and cloud-import refresh may finish later.

Refresh runs on screen focus, app foreground and calendar changes made inside Anastasis. There is no continuous device background synchronization, and changes made in another app while Anastasis remains foreground require manual Refresh. Cloud background synchronization uses the server cron documented in `../docs/CALENDAR_INTEGRATION.md`.

Native providers do not expose atomic conditional ETag writes. Fingerprints detect changes observed before a write, but the OS controls a change racing that write. Concurrent creates share one request, and a persisted pending marker prevents blindly repeating a creation after an uncertain crash. In that situation, refresh and check the calendar before starting a new event; do not assume remote delivery completed.

## Configuration and build

Set the existing public app configuration in `.env` or the build environment:

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_APP_API_URL
```

The API URL must point to the deployed Anastasis backend with the reviewed calendar migration/configuration applied. Never put provider tokens, app-specific passwords, encryption keys, or Supabase secret/service-role keys in Expo public variables.

From `anastasis-mobile`:

```sh
npm ci
npm run prebuild
npm run ios:dev
# Or, with an Android device/emulator:
npm run android:dev
```

Rebuild the development/production native client after adding calendar permissions; an old installed binary cannot acquire the new native module/configuration. Use a development build, rather than relying on Expo Go for these calendar APIs. iOS requires Xcode/signing and Android requires the Android SDK/device or emulator. Existing health native setup also remains required.

The config plugin requests full iOS calendar access and includes Android READ/WRITE_CALENDAR. Reminder-list permission is disabled; event alarms use calendar access.

## Verification

Passed locally: `npm run test:calendar` (8 pure/mocked tests), `npm run typecheck`, scoped ESLint, Expo config introspection, and production Hermes JavaScript exports for both iOS and Android. Tests execute the actual adapter with mocked Expo/device/storage/auth dependencies and cover CRUD, external edits/conflicts, permissions/revocation/read-only access, recurrence/all-day/DST, retries, disconnect and session isolation. They are not physical-device tests.

Production JavaScript export does not compile/sign/install an iOS or Android application. No real device, Google/iCloud account, native permission dialog, OS account upload, deployed cron, or production database was verified. Before release, run the connect → select → read → create → external change → refresh → explicit edit/delete flow on authorized iOS/Android test devices, including denied permissions, restricted meetings, recurrence, all-day dates, DST, mapped cloud duplication, account switching and disconnect.
