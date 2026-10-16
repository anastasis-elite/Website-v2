# EMBER schedule actions and progression repair

The Today dashboard can resolve eligible internal schedule activities without opening Schedule. This includes generated fixed commitments such as School drop-off. A fixed time prevents moving the commitment; it does not prevent recording its outcome.

## Investigation and implementation

The existing `ScheduleEventActions` component and `/api/schedule` handlers already supported completion for saved non-health records and deferral for movable records. Guided Today rendered only a navigation link. Generated commitments were excluded from completion, recurring commitment overrides were not applied, and the engine selected overdue items before important upcoming activities.

The repair reuses those components and endpoints, with shared capability checks and owner-scoped mutation helpers:

- **Complete:** saves `completed` and its timestamp. Required internal tasks add completion credit to the shared Today selector.
- **Skip:** saves `skipped`, clears completion evidence, retains the occurrence in history, and never grants completion credit. It does not change a fixed commitment's time.
- **Reschedule:** accepts an explicit future time only when the internal activity is movable and its reschedule/approval rules permit it. Original time is retained. The server checks bounds, conflicts, transition buffers and source availability. Virtual daily items stay within their day.
- **Dismiss from Today:** stores an owner-scoped, date-and-occurrence-specific preference. The underlying informational calendar event, status and occupied time remain unchanged. No provider write operation is called.
- Health logs and submitted assessments remain the authority for their completion. Matching health logs never complete informational calendar events. A previous reschedule snapshot never overrides later real health completion.

Persisted events use their existing table. Virtual outcomes, original occurrence snapshots and dismissals use the existing `clients.onboarding_data` owner-scoped compare-and-swap. No schema migration is required. Completed/skipped personal occurrence snapshots remain accessible even after their recurring template changes. Schedule supports date selection and displays dismissed-event history.

The queue retains existing safety and first check-in behavior, then selects current events, important upcoming events, overdue events, and remaining optional events. Overdue actions remain directly reachable in Today even when another activity has priority. Responses include refreshed schedule state; the dashboard also applies a saved event immediately, refreshes server-rendered readers and announces a calendar change across tabs. Loading, explicit skip/dismiss confirmations, error messages, retry controls and request locks are present. A 409 refreshes stale state.

## Progress semantics

Today, Schedule and Progress use the same `buildTodayActivities` required-activity selector. Its denominator is derived from applicable health requirements, submitted-assessment tasks and required internal schedule activities. Skips stay in the denominator without becoming completions; optional and informational calendar events do not add required completion credit. Schedule outcome mutations never write check-in or streak records. Existing health and check-in evidence remains authoritative.

## Verification scope and scenarios

**These results are isolated synthetic verification, not acceptance on a signed-in live EMBER account.** Route/service tests execute the application handlers against disposable records, with a separate local Postgres concurrency check. Browser checks use real components and a development-only fixture with simulated transport/authentication; external traffic is blocked. A real synthetic EMBER account was requested but was not supplied in this session.

| # | Scenario | Isolated result | Evidence / limit |
|---|---|---|---|
| 1 | Complete an overdue task | PASS | Saved outcome, timestamp, queue advance, required progress; generated School drop-off included |
| 2 | Skip an overdue task | PASS | Distinct skipped status; no completion credit; occurrence retained |
| 3 | Reschedule eligible task | PASS | Adjusted time retained; original time preserved; stale/conflicting/out-of-bounds requests rejected |
| 4 | Dismiss informational event | PASS | Date-scoped preference; source status/busy time unchanged |
| 5 | Refresh page/read state | PASS | Fresh request readers retain outcomes and dismissals |
| 6 | Log out and back in | NOT TESTED | Request-context and simulated session re-entry tests pass; real auth lifecycle needs a dedicated account |
| 7 | What’s Next advances correctly | PASS | Current/upcoming/overdue/optional ordering and resolved-item exclusion |
| 8 | Progress reflects actual completion | PASS | Dynamic denominator; skips/informational events grant no false completion; check-in evidence unchanged |
| 9 | Schedule reflects same statuses | PASS | Shared projection, history and original/adjusted times; matching statuses confirmed in the manual browser check |
| 10 | External calendars not unintentionally modified | PASS | Mutation isolation and external marker protections; actual provider synchronization is NOT TESTED |
| 11 | IGNITE and PHOENIX remain functional | PASS | Tier/capability regressions and synthetic dashboard coverage |
| 12 | Two rapid actions cannot create conflicting statuses | PASS | UI request lock; competing complete/skip and move requests; per-event DB/JSON CAS; local Postgres conditional write |

Automated result: clean scoped source **611 tests passed**, zero failures/skips; nonincremental TypeScript and production build passed. The shared working copy passes **616 tests**, including five preexisting, unrelated entitlement tests deliberately excluded from this change. Lint passes with existing unrelated warnings. The subsequent native datetime-input hardening passed 23 targeted UI tests, nonincremental TypeScript and the production build in the same clean source copy. Manual browser receipts are in `ember-schedule-browser-2026-10-15.json`; source validation receipts are in `ember-schedule-source-validation-2026-10-15.json`.

Independent code review identified two projection edge cases (moved health completion and informational health events); both were fixed and regression tested. No remaining blocking finding was reported.

Concurrency protects one occurrence across competing actions. Two different activities choosing the same empty time simultaneously are not serialized in a cross-event transaction; no cross-record scheduling guarantee is claimed.

## Security and release boundary

Read-only production catalog inspection confirmed RLS on `clients` and `anastasis_schedule_events`, owner SELECT/UPDATE policies, and UPDATE ownership checks. The implementation uses the verified member session, owner/client predicates, status/version comparisons, monotonic mutation timestamps and the existing JSON CAS helper. It adds no service-role browser access, provider writes, billing changes or entitlement changes. All three tiers already have calendar and What’s Next access.

The Supabase security advisor returned the existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and seven informational server-only tables with RLS but no browser policies. No database security configuration was changed.

Latest remote inspection: `origin/main` at `c873fbedaab62ceb318e45c6d4bb6ca65bfad581`, including merged PRs #10 and #11; no open pull requests at initial inspection. This change uses `codex/ember-schedule-actions`. Existing local recovery, calendar-session transport, entitlement, SQL and release evidence work was preserved and excluded from the scoped source build and commit.

Production is unchanged. The release remains subject to review and authenticated synthetic-account acceptance. Follow the established sequence: reviewed source SHA, production build with custom domains held, authenticated staged checks, then promote the same verified artifact. Do not upload the shared dirty workspace or promote a preview as a substitute for staged production acceptance. No live login/logout or actual provider synchronization pass is claimed.


## Manual browser acceptance

Real components in the isolated EMBER fixture passed Complete (3/6 to 4/6; next card advanced), confirmed Skip (still 4/6), Reschedule (saved 21:00; upcoming status), informational dismissal, refresh, and Schedule status/history consistency. At 390px Schedule had no horizontal overflow; at 320px Today had no overflow and all three action buttons measured at least 44px high and wide. IGNITE and PHOENIX completion smoke checks also advanced to the next item.

The manual datetime check exposed a native input/change-event timing issue. Reschedule now reads the selected input value at save time, so it cannot silently save an earlier React state value. The corrected browser save showed the requested 21:00 time and an Upcoming row; the matching Schedule history retained the original 09:00 time.

The new browser automation script was **NOT RUN**: a duplicate server-start approval in that worker remained pending and was then canceled. No automated-browser PASS or real authentication PASS is claimed. The manual browser used the separately approved isolated server. Temporary fixture route and test server were removed/stopped after acceptance.
