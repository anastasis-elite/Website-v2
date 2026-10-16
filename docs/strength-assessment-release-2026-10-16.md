# Strength assessment P1 repair — 16 October 2026

**Implementation complete; production release held for authenticated browser acceptance.** The additive migration has not been applied to production, and the application has not been promoted. The owner's assessments were inspected read-only; no customer measurements, plans, membership, schedule, or calendar records were changed.

## Findings and recovery

1. **“Load failed” request:** the existing strength form has one browser request, `POST /api/assessment-strength`. It forwards raw `error.message` to the screen, including Safari's transport message. There is no draft GET in that form. Historical browser network capture is unavailable, and Vercel's Hobby runtime-log retention had expired for the incident; the precise network interruption cannot be established. Do not represent this message as proof that the database write failed.
2. **October owner records:** two strength assessments exist, submitted at `2026-10-16T13:04:47.477Z` and `2026-10-16T13:15:55.912Z`. Each contains a 28-key payload with height and weight. Metadata-only comparison found four different measurement fields. Supabase request aggregates show both assessment POSTs returned **201**, both program-output POSTs returned **201**, profile writes returned **201/200**, and relevant assessment/profile/plan reads returned **200**. No failed database request was found in that submission window.
3. **Values are recoverable:** both original rows and both generated outputs remain intact. New read-only history selection can open either saved result without rewriting it. No private measurement values, email addresses, account UUIDs, tokens, or credentials are included in this report.
4. **False Due:** the dashboard's strength card used the separate monthly check-in count, based on `assessment_type='monthly'` and a rolling 30-day interval. Strength writes use `assessment_type='strength'`. The owner has two October strength records and zero October monthly check-ins. The new strength status uses its own calendar-month period; monthly check-in remains separately labeled.
5. **Partial/duplicate writes:** the old endpoint inserted the assessment, then updated the profile and created a plan in separate requests. Failures after the first insert could report an error despite a saved baseline, and retries could append duplicates. The new database operation commits final assessment, session completion, profile, and generated plan atomically.

## Implementation

- `strength_assessment_sessions` stores owner-scoped string values, explicit `draft`/`completed` state, period, revision, confirmed save timestamp, final timestamp, and immutable assessment reference. Existing assessment rows remain untouched; a nullable `assessment_period` distinguishes late completion of an earlier month's draft from the month of its completion timestamp.
- Authenticated GET restores drafts and final results; PUT saves incomplete drafts; POST validates and finalizes. Authenticated membership supplies identity, program, and timezone. An expected client ID rejects an account change before saving old in-memory measurements into another account.
- The invoker RPC locks the owned client, checks revisions, validates final values in PostgreSQL, and returns confirmed persistence. Identical final retries return the original completion. Divergent/stale writes require deliberate review. Completed sessions cannot be overwritten. Legacy final records take precedence without deletion or backfill.
- Debounced autosave waits 800ms; Save Draft is always available on the form. Confirmation timestamps, loading failures, save failures, submission failures, retry, and conflict review are distinct accessible states. Values remain in memory through failed/offline requests. No assessment payload enters browser storage or a service-worker cache.
- Link navigation, browser Back/Forward, reload/close, and the application sign-out action guard unsaved work. Browser/OS termination can still discard values that were never cloud-saved; the screen explicitly says to keep the page open while offline. Protected offline disk persistence is not implemented.
- Existing drafts retain their original month after rollover. A form opened before midnight with no successful first save can explicitly carry its retained values into the empty new month. It checks for an existing destination assessment before saving. Completing an older month preserves a newer current profile and plan.
- Dashboard, Progress, workout Strength, and monthly assessment pages share explicit Due / In Progress / Completed status, original dates, save timestamps, and start/resume/results actions. Confirmed form writes refresh the router; final completion invalidates dashboard data. Failed reads show Status unavailable instead of a false Due.

## Verification

| Check | Result |
| --- | --- |
| Isolated release automated suite | **PASS — 641 tests, zero failures/skips** |
| Shared workspace automated suite | **PASS — 696 tests, zero failures/skips** |
| Nonincremental TypeScript | **PASS** in isolated release after build regenerated Next types |
| Optimized production build and lint | **PASS**, existing unrelated warnings only; Next 15.5.28 |
| Disposable PostgreSQL | **PASS** — real invoker functions/RLS, partial strings, revision conflicts, atomic rollback on injected plan failure, final replay, immutability, legacy preservation, month rollover, timezone fallback, cross-user and anonymous denial |
| Controller/hook/API tests | **PASS** — every value restored in a new synthetic session, 800ms debounce, rapid save/final serialization, offline retry, ambiguous final-response recovery, account switch, navigation/sign-out guard, historical selection, new-month carry |
| Browser harness syntax | **PASS** — fixture and smoke scripts parse |
| Real browser smoke/screenshots | **NOT TESTED** — local bind failed `EPERM`; the requested server-start escalation was subsequently aborted. No screenshots were produced. |
| Real Supabase login and cross-device API smoke | **NOT TESTED** — no private dedicated synthetic login fixture supplied |
| Live acceptance guard | **PASS** — missing credentials/opt-in exits 2 with NOT TESTED before authentication or writes |
| Production database migration / application promotion | **NOT PERFORMED** |

Local controller sessions and mocked HTTP transport do not establish live Supabase authentication or production browser success.

## Release isolation and remaining gate

The repair is prepared in `/private/tmp/anastasis-strength-verified-20261016` on `codex/strength-assessment-drafts-20261016`, based on verified GitHub main/production commit `c873fbedaab62ceb318e45c6d4bb6ca65bfad581`. The original workspace remains on its schedule release branch. Its unreleased schedule/calendar implementation and prior outstanding files are preserved. Only strength additions from the shared logic engine and Progress page were transferred to the release checkout. The existing reviewed dependency patch lockfile was retained so the release installs the versions used by the passing build; no new dependency was added.

Production remains READY at `https://anastasiselite.com`, deployment `dpl_6zgWx3hHhjMrQqUUuaq54T3zxFvL`, with commit `c873fbe`. A final read confirmed the owner's two October strength records remain present and the new draft table remains absent.

Before promotion:

1. Start the isolated browser fixture with approved local-server access and run `scripts/strength-assessment-browser-smoke.mjs`. It uses copied real components and intercepted synthetic transport; it does not copy production cookies, secrets, environment files, or health data. Run against 320/390/1440px and inspect the saved screenshots.
2. Supply two dedicated, normally onboarded synthetic test accounts through the supported Auth administration/onboarding flow. Store their credentials only in a private file outside Git, mode 0600. No owner/customer account or password reset should substitute. Required fixture shape is below; public keys only, never service-role keys.
3. Apply **only** `supabase/migrations/20261016142645_strength_assessment_drafts_atomic.sql` in the pinned project `lcccpqgnpznhbtmkmytp`. This is additive and preserves all existing data. Do not apply unrelated pending schedule/PR10 migrations. Review advisors after applying it.
4. Use the repair branch's established PR/check workflow. Stage a production artifact without assigning domains. Run the real Auth/API harness against that exact artifact, then browser smoke for dashboard/Progress, refresh, sign-out/sign-in, resume, offline/retry, final completion, and cross-user isolation using only the dedicated accounts.
5. Promote the exact tested artifact only after all required checks/approvals pass. Verify the custom domain's deployment and SHA, and repeat production smoke. Keep the existing deployment available for rollback; retain the additive schema on application rollback and never delete historical assessments.

```json
{
  "syntheticOnly": true,
  "supabaseUrl": "https://lcccpqgnpznhbtmkmytp.supabase.co",
  "publishableKey": "<public publishable or legacy anon key>",
  "accounts": [
    {
      "email": "strength-release-qa-<unique-a>@example.invalid",
      "password": "<private generated password>",
      "userId": "<pinned Auth UUID>",
      "clientId": "STRENGTH-RELEASE-QA-<unique-a>"
    },
    {
      "email": "strength-release-qa-<unique-b>@example.invalid",
      "password": "<private generated password>",
      "userId": "<different pinned Auth UUID>",
      "clientId": "STRENGTH-RELEASE-QA-<unique-b>"
    }
  ]
}
```

Both Auth identities must have server-controlled `app_metadata.strength_release_qa=true`, a client name beginning `Strength Release QA`, active access, completed ordinary onboarding/initial assessment, and no current-month strength record for the new draft/completion test. The harness retains its synthetic completion history; it does not delete immutable records.

```sh
node scripts/verify-strength-live-acceptance.mjs \
  --fixture /private/tmp/strength-qa-private.json \
  --base-url https://<exact-staged-deployment> \
  --allow-synthetic-writes \
  --receipt /private/tmp/strength-live-receipt.json
```

Without prerequisites the harness reports NOT TESTED; no deployment or live acceptance success is implied by the prepared scripts.
