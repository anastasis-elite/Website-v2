# Guided Today implementation

## Inspection checkpoint

Starting branch: `codex/coordinated-daily-dashboard`, HEAD `6f03da2`.
Pre-existing work: `app/about/page.tsx`, `tsconfig.tsbuildinfo`, `supabase/.temp/`.
These files are outside this change. Baseline: 425 tests and typecheck pass.

The existing shared recommendation, local clock, canonical health logs, calendar actions,
and tier capabilities are the foundation. Today will coordinate these workflows without
replacing readiness, programming, macro calculations, or billing.

## Implementation plan

1. Share one branded Today header and workspace across EMBER, IGNITE, and PHOENIX.
   Show a local greeting/date, recorded applicable activity progress, one next step,
   and directly accessible activity states. Keep advanced calendar/progress panels.
2. Derive activity completion from existing logs. Persist daily defer/skip/resume and
   explicit schedule review in owner-scoped member preferences, with concurrency checks.
   Skips never mean completion. No schema migration is required.
3. Use Today, Schedule, Progress, and You navigation. Keep all current wellness tools
   in context and in You. Show check-in energy first; preserve exact established inputs
   and reveal optional questions progressively. Protect interrupted drafts by member/day.
4. Validate state transitions, local-day boundaries, ownership, optional activity counting,
   tier gates, errors, responsive navigation, and save/reload using disposable fixtures.
   Run full tests, lint, typecheck, build, diff review, and visual review.

## Safety boundaries

No production data writes, destructive migrations, purchases, pricing changes,
deployment, or rollback of ongoing work. Browser fixture saves are explicitly simulated.
Connected staging save/readback remains a separate release check when credentials and
a disposable member account are available.

## Final implementation report

The member home now presents a local greeting and date, recorded daily progress, one
prominent next action, and a compact list of directly accessible activities. The same
hierarchy serves EMBER, IGNITE, and PHOENIX on mobile and desktop. Optional activities
are labeled and excluded from the essentials denominator. One-step display preferences
reduce supporting copy without removing access to activities.

### What changed

- `TodayDashboardHeader` and `GuidedToday` replace the three competing tier home layouts.
  Brand colors and typography remain in the established design system. The activity list
  exposes available, upcoming, in-progress, completed, deferred, and skipped states.
- `todayActivities` derives evidence from existing check-in, hydration, intake, workout,
  and recovery records. Partial workouts and partial water intake remain in progress.
  Skips never count as completion. Unavailable workouts or targets never add requirements.
- The existing shared recommendation honors held activities, accepted future workout
  times, current commitments, and evening/recovery context. Safety guidance retains
  priority. No new exercise, dosing, readiness, or clinical algorithm was introduced.
- `/api/dashboard/activities` saves explicit schedule review and daily defer/skip/resume
  preferences in existing `clients.onboarding_data.dailyGuide`. Defer lasts up to an hour,
  bounded by member-local midnight; repeated retries do not extend the hold. A member
  can resume early. Times and skips already saved in Schedule are changed in Schedule.
- Owner-scoped JSON compare-and-swap protects guide saves, transition/display preference
  saves, and virtual schedule edits from overwriting concurrent dashboard choices.
- Navigation has four equal destinations: Today, Schedule, Progress, You. You retains
  account, workouts, nutrition/hydration, check-in, recovery, sleep, meditation, cycle,
  assessment, calendar, and support access. PHOENIX recipes keep their gate. The newly
  proposed Community shortcut was removed after review found the existing route is a
  sample-data prototype; its existing route was left intact.
- Check-in shows the established 1–10 energy input first. Sleep, stress, soreness, mood,
  hunger, notes, cycle context, and the detailed symptom logger remain available through
  disclosure. Soreness-region validation and untouched-answer omission remain intact.
  An unchanged midpoint requires an explicit choice. Saved state uses the real completion
  marker, not the presence of an older energy value.
- Unsaved check-in drafts resume in the same browser tab and are scoped to member, tier,
  and local day. Submitted answers use the existing database persistence. Successful saves
  clear drafts and return to Today on the standalone page. Server and client checks reject
  stale forms across local midnight. Submit locking and per-day upsert remain in place.
- Compact workflow cards offer Return to Today and disclose detailed readiness context.
  Advanced calendar/progress/assessment controls remain secondary views. The detailed
  calendar and symptom map load only when opened; independent home reads run together.
  Today has explicit loading and retry states.
- Tutorial identity and step IDs remain stable. Guidance now points to the new navigation;
  hydration is explained without forcing a detour during onboarding. Assessment steps
  point to visible Progress navigation rather than hidden panels.
- Existing PostHog instrumentation receives Today views, check-in starts/completions,
  next-action opens/completions, and defer/skip/resume events. Payloads use only fixed
  activity IDs, tier, and source. Answers, notes, member IDs, calendar titles, and health
  measurements are not sent. Local journey bookkeeping avoids duplicate completion
  events and does not treat reviewing historical work as new completion.

### Existing functionality preserved and reused

The implementation reuses `ProgramLogicOutput`, `DailyScheduleState`, tier capabilities,
the shared daily recommendation, timezone/refresh helpers, `DailyCheckInForm`, AOS form
controls, symptom/soreness tools, `DailyPlanCard`, hydration and nutrition loggers, workout
session controls, recovery logging, connected calendars, and the existing Progress,
Assessments, and Trends panels. Historical logs, existing adaptations, entitlement checks,
API logging workflows, account/billing controls, and subscription prices were retained.

### Validation

| Check | Result |
| --- | --- |
| `npm test` | **455 passed**, 0 failed, 0 skipped; baseline was 425 |
| `npm run lint` | Passed with existing repository warnings |
| Nonincremental TypeScript | Passed after the final build regenerated route types |
| Production build with local dummy service configuration | Passed; temporary QA route absent from production output |
| Browser journey | **47 checkpoints passed** at 390×844 and 1440×1000 across all three tiers, plus 320×740 IGNITE |
| Diff whitespace and temporary fixture cleanup | Passed; QA route removed before build |

Browser checks used actual UI components with explicit disposable transport, denied camera
access, and blocked external network requests. They verify fresh/returning Today, one
primary action, four 44px-or-larger navigation targets, You menu/Escape focus restoration,
failed defer retry, saved defer after reload, resume, optional skip honesty, explicit
schedule review, interrupted check-in drafts, failed check-in retry, exactly one successful
save, omitted unanswered fields, next-action advancement, partial hydration, Progress,
tier-specific food logging, and narrow-screen overflow. No browser exceptions occurred.

Automated regressions separately execute real API handlers with disposable transport and
PostgreSQL fixtures. They cover ownership, unknown/invalid actions, stale dates, local
midnight/DST boundaries, confirmed completion over older preferences/schedule copies,
optional/inapplicable counts, accepted future movement, concurrent-device JSON merges,
CAS exhaustion, safe failures, retry idempotence, health save/readback, and analytics privacy.
The browser fixture does not establish connected Supabase or live cross-device behavior.

### Visual review

These are isolated QA screenshots; the visible QA banner and development indicator are
not part of the member product. Full-page captures show the fixed navigation at the
viewport position; it stays at the bottom while scrolling in the actual interface.

| Mobile | Desktop |
| --- | --- |
| [Fresh Today](screenshots/guided-today/mobile-ignite-today-fresh.png) | [Fresh Today](screenshots/guided-today/desktop-ignite-today-fresh.png) |
| [Returning Today](screenshots/guided-today/mobile-ignite-today-returning.png) | [Returning Today](screenshots/guided-today/desktop-ignite-today-returning.png) |
| [Saved check-in](screenshots/guided-today/mobile-ignite-check-in-saved.png) | [Saved check-in](screenshots/guided-today/desktop-ignite-check-in-saved.png) |
| [320px Today](screenshots/guided-today/mobile-ignite-today-320px.png) | [Progress](screenshots/guided-today/desktop-ignite-progress.png) |

The complete browser checkpoint list is in `screenshots/guided-today/results.json`.

### Remaining limits and release risks

- Connected staging login, real Supabase browser save/readback/RLS, and actual second-device
  synchronization still need a disposable authorized account. Guide choices synchronize
  through existing refresh/revisit behavior; no new live subscription was added.
- Unsaved drafts intentionally stay in one browser tab; only submitted answers and saved
  guide choices persist across supported devices. Existing live calendar/wearable/food
  providers and PHOENIX photo estimation remain dependent on their existing configuration.
- Onboarding profile resubmissions now use the same owner-scoped compare-and-swap merge
  as dashboard preference writers. A focused regression verifies concurrent Today choices,
  transition preferences, and schedule overrides survive the retry; exhausted comparisons
  return a recoverable conflict without initializing the profile or claiming completion.
- Prior documented cycle-phase/clinical algorithm questions remain unchanged. No new
  clinical claims or programming decisions were invented.
- No schema migration, production health mutation, purchase, billing change, deployment,
  or push occurred. Existing About edits, generated TypeScript state, and Supabase temporary
  files were preserved. Production release requires connected staging validation and approval.

Recommended follow-up: run the connected staging smoke and review the previews with a few
members on their own phones.

### Reproduce browser checks

Install the opt-in fixture, start local development with the dummy configuration documented
in `docs/ignite-dashboard-stability-audit.md`, and run
`scripts/verify-guided-today-browser.cjs` with an installed Playwright module and Chromium
binary via `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE`. Only localhost is accepted.
Stop development and run `node scripts/dashboard-browser-fixture.mjs --remove` before
the production build. The fixture script refuses to delete edited files.
