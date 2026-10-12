# Ignite dashboard stability audit — October 12, 2026

This audit traced the existing dashboard, recommendation engine, calendar, logging components, API handlers, and tier capabilities before changing them. Existing architecture, calculations, database migrations, authentication, billing, and account settings were retained. No customer records, live database, or production deployment were changed. The pre-existing About-page edits, generated TypeScript state, and Supabase temporary files are excluded from this work.

## Findings and changes

| Report or requirement | Reproduction and resulting change |
| --- | --- |
| Zero-pound prescriptions and incompatible selectors | Zero is already accepted as a valid added load; regression tests retain that behavior. Reproduced a missing variant appearing as the first, incompatible selection and manual wildcard equipment being normalized into bodyweight. The prescribed movement now has an honest placeholder, selected bodyweight variants suppress load fields, missing loads remain unspecified, and manual equipment selection preserves the inventory. |
| Work block routes incorrectly | Reproduced the dormant `AdaptiveTodayForYou` row inheriting the shared hydration route. It now uses the existing event routing helper. Live generated Work/School commitments already routed to Daily Structure; positive regressions protect them. |
| Calendar dismissal persistence | Detailed calendar had no explicit persisted dismissal action. Added Dismiss time, browser persistence, restoration, and clear storage-failure feedback. Dismissal is scoped to client, local day, and exact proposal ID/start/end; changed proposals return and saved commitments remain visible. Schedule Skip was already persisted and its behavior is retained. |
| Unexplained disabled completion | Reproduced missing prerequisites for recovery completion and manual Finish Exercise. Visible instructions and accessible descriptions explain selection or the first recorded set. Recovery network errors now release the saving state and permit retry. Schedule activity completion continues to direct users to its logger; fixed commitments retain their explanation. |
| Duplicate November 1 in October | **Not reproduced.** Existing generation yields 42 unique cells, with November 1 once. Generation is unchanged. Tests cover October in UTC, Chicago, Havana, London, and Auckland, plus leap, year, and daylight-saving boundaries. |
| Incorrect greeting / stale next label | Timezone calculations already use the member's timezone. Reproduced missing idle refresh at greeting/daypart changes. Shared plan cards now refresh at local 11:00, noon, 17:00, event starts/ends, midnight, and visibility/focus/mutation changes. Schedule avoids a duplicate refresh listener; no minute polling was added. |
| Check-in first; one next action | Daily check-in precedes ordinary commitments and recovery-only guidance until recorded; urgent red-flag guidance retains priority. One shared contextual primary action appears across dashboard pages. Supporting links remain visible in quiet mode, and existing navigation retains access to other domains. |
| Missing recovery inputs | An incomplete check-in no longer presents the fallback numeric recovery score as confirmed. The explanation names available and missing sleep duration, sleep quality, energy, stress, and soreness inputs. Existing engine scores and guidance are preserved when inputs are complete. |
| Food ideas without prior meal logs | Removed the zero-meal short circuit. Suggestions use targets or honest general starting options, distinguish missing data from satisfied targets or no catalog matches, and retain exclusions/allergy filtering. The hero offers a concrete food/serving or Explore Suggested Foods action without demanding a prior log. |
| Schedule counts | Month counts distinguish saved events from proposed activities and open time. Available windows no longer inflate event badges. |
| Repeated exercises and logging | Repeated names have visible occurrence numbers and independent sets. Editing preserves recorded work. Explicit set updates accept decimal nonnegative weights and positive whole reps; typing does not issue saves. Correction clears conflicting skipped state. Manual summaries use recorded sets consistently. |
| Useful preferences | Home, calendar mode/daypart, nutrition, recovery, workout tabs/mode, and active manual exercise resume in the browser. Keys are client/tier scoped where needed; damaged/restricted storage fails safely. Drafts reset at member-local midnight and do not migrate to another client/tier. Explicit calendar daypart choices persist; Today returns to automatic selection. |
| Responsive interaction defects found during QA | Fixed consent controls being blocked by the fixed navigation, narrow navigation label clipping, and manual set editor placement. Reproduced hamstring polygons intercepting quadriceps clicks; Front/Back switches now use existing muscle-region metadata and retain all choices. SVG region buttons support Enter and Space. |

## Entitlements and scope

Ember remains without meal logging. Its existing macro entry is labeled Macro Entry/Add Macros, and food ideas do not enable a meal logger. Ignite retains manual/barcode entry and its photo denial. Phoenix retains photo/recipe access. UI, API authorization, ownership, and tier regressions protect these boundaries. No production health, billing, or account-setting mutation was performed; browser display preference saves used disposable transport.

## Validation

The initial full suite passed 367 tests. The final suite passes 425 tests after the changes below. Test coverage is behavioral: actual component callbacks/effects, actual handlers with isolated transport, and existing SQL functions against disposable PostgreSQL fixtures. The browser suite uses actual components with simulated local endpoints; it does not establish a connected Supabase end-to-end result.

| Check | Final result |
| --- | --- |
| Full `npm test` | **425 passed; 0 failed; 0 skipped** |
| `npx tsc --noEmit --incremental false` | Passed; also checked after production route types regenerated |
| `npm run lint` | Passed with existing repository warnings; no new dashboard warnings |
| `npm run build` with local-only dummy configuration | Passed; temporary QA route absent from production route output |
| `node scripts/verify-daily-dashboard-migration.mjs` | Passed: additive compatibility, water retry deduplication, invalid inputs, atomic rollback, resumed sessions, atomic set edits, preserved history, owner RLS and anonymous denial |
| Local Chromium journeys | **29 checkpoints passed**: 14 journeys each at 390×844 and 1440×1000, plus Home at 320×740; no browser exceptions, horizontal overflow, or clipped navigation labels |
| `git diff --check` and staged diff check | Passed |

New regression files cover calendar/routing/dismissal, idle clock boundaries, actual refresh-hook cleanup, check-in/water/recovery save-reload, nutrition/recovery/tier behavior, and workout controls/drafts. Existing meal and workout journey tests exercise save/readback, retries, tier denials, and retained history. Schedule API tests cover authorized skip/move and activity completion rejection; browser tests cover accepted suggestions and skipped events after reload/revisit.

The local browser journey checks daily check-in, zero-log food suggestions, hydration, meal saving, recommended workout correction/pause/history/partial completion, manual set saving/correction/resume, recovery history, schedule accept/skip, calendar mode/dismiss/restore, quiet-mode access, and Ember/Phoenix entitlements. Each capture asserts no horizontal page overflow or clipped navigation labels. Screenshots are in [screenshots/ignite-stability](screenshots/ignite-stability).

## Repeating the isolated browser checks

Install the disposable route and start local development with fake service configuration:

```sh
node scripts/dashboard-browser-fixture.mjs --install
NEXT_PUBLIC_SUPABASE_URL=https://local-qa.invalid NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-qa-only npm run dev -- --hostname 127.0.0.1 --port 3100
```

In another terminal, point the opt-in script at an installed Playwright module and compatible Chromium binary:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CHROMIUM_EXECUTABLE=/absolute/path/to/chromium node scripts/verify-ignite-dashboard-browser.cjs
```

Only localhost is accepted, external requests are blocked, unknown mock endpoints fail closed, and the fixture refuses production rendering or a real Supabase URL. Data belongs to `LOCAL-QA-ONLY` and stays in the disposable browser context. Stop the server and remove the route before a release build:

```sh
node scripts/dashboard-browser-fixture.mjs --remove
```

## Blocked checks, remaining risks, release readiness

- A connected staging login and browser → real API → Supabase save/readback/RLS journey were not run: no authorized disposable non-production account and service configuration were available. Local handler, SQL, and simulated browser results do not replace that check.
- Live wearable/calendar-provider freshness, live food catalog availability/allergen completeness, barcode provider responses, and Phoenix photo estimation remain provider-dependent and unverified in this audit. Existing provider availability/fallback behavior and tier denials remain covered; no provider/account configuration was changed.
- Browser view preferences and cosmetic dismissals are local to a browser, not synchronized across devices. Restricted storage reports visit-only dismissal behavior. Schedule Skip remains a server action.
- The existing cycle-phase adjustment algorithm and broader clinical interpretation were not redesigned. The previously documented symptom-first/estimated-phase question remains outside this stabilization scope.
- Existing unrelated lint warnings remain. No deployment was attempted or authorized.

**Ready for connected staging verification.** Local regressions, typechecking, lint, the production build, isolated SQL, and responsive browser checks pass. Production release remains conditional on the connected staging smoke above and explicit deployment approval. Validated changes are committed together; no deployment or push was performed.
