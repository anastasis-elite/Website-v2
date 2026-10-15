# Anastasis mobile UX + PWA release candidate — October 14, 2026

Implemented and locally validated. Production promotion is held pending authenticated physical-device and installed-PWA acceptance. The PWA performance issue is **not declared resolved**, and the 1/2/3-second mobile startup goals are unverified. No physical mobile device or designated acceptance account was available in this task.

## Delivered behavior

- Dashboard water, food and meal actions use direct entry URLs. Existing schedule anchors and recipe destinations retain contextual meals. Direct routes enforce existing authentication, membership, onboarding and safety checks, then read one daily log without initializing the full personalized program engine or schedule.
- Water uses one shared dialog with the original 4–64 oz slider, 4/8/12/16 oz presets and exact decimal manual input. Selecting an amount does not save; one confirmation does. Confirmed persisted totals update immediately. The verified `/api/nutrition/add-water` route and `add_daily_water` RPC are unchanged.
- Retry receipts retain the original UUID after another tab clears storage. Earlier-day receipts are checked through an owner/day-scoped read; only an actual saved UUID proves persistence. Explicit new-day recovery durably archives an uncertain earlier tuple before releasing today's entry slot. Storage failures retain the active receipt. Archived attempts are never retried or counted as today's water.
- Meal context is editable before food search and remains shared across manual, barcode and photo methods. Methods load independently and retain drafts. First-use log preparation ignores conflicting existing daily rows, preserving their targets, water, legacy meals and completion state. EMBER retains guidance/macros; IGNITE/PHOENIX food logging entitlements and API guards are unchanged.
- Accessible SVG rings use saved daily targets and confirmed persisted food nutrient values multiplied by saved grams. Percentages remain visible above 100%; ring strokes cap at 100. Missing targets, unknown nutrients, partial foods, macro-only intake and no-food days are explicit. Reference comparisons check units, intake source, nutrient form and known demographic context. Unmatched inferred UL insights cannot override those checks. Excess is never presented as an achievement.
- Restored near-black Today/cards/dialog/navigation/loading surfaces and restrained metallic copper controls. Removed the large brown Today and next-step gradients.
- Streamed nonpersonal and authorized action shells, request-only member context deduplication, parallel daily reads, daily-plan reuse, deferred recommendation audit, bounded optional schedule reads, independently recoverable optional calendar, and on-demand charts. Analytics loads after initial rendering.
- Exact hashed static assets use cache-first retrieval. Authenticated HTML, API and RSC data remain uncached. Existing browser data and update-consent behavior are preserved. Resume events coalesce; local-midnight refresh covers every dashboard page without minute polling.

## Measured before/after evidence

| Measurement | Before | After | Meaning |
| --- | ---: | ---: | --- |
| Initial dashboard JavaScript, union of root/layout/program chunks, gzip | 270,367 bytes | 203,648 bytes | **24.7% smaller**. Local production build artifacts; not device startup time. |
| Same JavaScript, raw | 914,113 bytes | 707,033 bytes | 22.7% smaller. Deferred modules still download when needed. |
| Optional schedule-loader median, five samples with fixed 40 ms simulated read latency | 169.23 ms / 4 reads | 42.22 ms / 3 reads | **75.1% lower synthetic latency**. Node orchestration experiment; no real database/browser/device transport. |
| Physical mobile cold start: shell / primary / secondary | Not measured | Not measured | 1/2/3-second goals remain unverified. |
| Physical mobile warm start and installed-PWA resume | Not measured | Not measured | Required before declaring performance resolved or promoting production. |

The baseline bundle is the pre-existing production artifact saved before edits, timestamped 2026-10-14 10:38 UTC. The final build uses explicitly fake local service configuration. Asset inventories, bytes and samples are in [baseline](mobile-pwa-bundle-baseline-2026-10-14.json), [after](mobile-pwa-bundle-after-2026-10-14.json), and [loader experiment](mobile-pwa-loader-latency-2026-10-14.json). These measurements exclude device networking, rendering, hydration, authentication and service-worker launch costs.

Read-only cumulative production `pg_stat_statements` sampled during this task:

| Operation | Calls | Mean SQL execution | Maximum SQL execution |
| --- | ---: | ---: | ---: |
| Water RPC | 2 | 9.92 ms | 16.25 ms |
| Nutrition totals by block | 355 | 3.17 ms | 82.57 ms |
| Nutrition remaining | 301 | 2.16 ms | 77.08 ms |
| Member lookup | 1,716 | 0.49 ms | 101.87 ms |
| Daily nutrition log | 941 | 0.47 ms | 23.51 ms |

These are cumulative database execution statistics, not before/after HTTP latency, named-account timings or startup traces. The logs source inventory was readable, but the attempted log-field aggregation returned a backend error; no clean request/error-rate claim is made. A fresh read-only catalog confirmed the working water RPC signature. The production nutrient-reference table contains zero rows, so configured numeric upper limits are unavailable. No reference values were invented or written.

## Acceptance actually completed

| Check | Result / limit |
| --- | --- |
| Full automated suite | **542 passed, 0 failed, 0 skipped**. Includes hydrated controls, persisted totals, same-ID retry, stale tab, prior-day receipt archival, ownership/date negatives, macro-only nutrient coverage, tier guards, cache/update safety, schedule recovery and midnight/DST checks. |
| TypeScript | Passed, including nonincremental check after build. |
| Lint | Passed with existing repository warnings. |
| Production build | Passed; temporary QA route removed. |
| Diff whitespace | Passed. |
| Mac in-app browser, mobile viewport | Disposable local fixture at 390 × 844 and 320 × 740; this is **not** a real mobile browser or installed PWA. |
| Direct water | Dashboard action opened dialog. Preset → slider keyboard change → exact 10.5 oz manual input → one confirmed simulated save; total became 10.5 oz and remained on subsequent navigation. |
| Direct meal/food | Breakfast preselected, changed to Lunch, selected food/serving, switched Barcode and back with draft retained, saved Lunch once; saved item and remaining macros updated. |
| Micronutrient display | Saved synthetic serving yielded calcium 187/150 mg, text 125%, stroke `100 100`. Missing potassium showed Unknown / percentage unavailable. Card background measured `rgb(11,11,11)`; no document horizontal overflow. |
| Tier boundaries | EMBER direct meal showed guidance only; IGNITE manual/barcode; PHOENIX manual/barcode/photo with editable Dinner context. API entitlement regression tests passed. |
| Photo availability | Existing backend remains unavailable. PHOENIX showed explicit unavailable state with manual fallback. |
| Real hydration/food save in production | Not exercised without a designated test account. Existing backend contracts preserved; local tests are not live acceptance. |
| Actual mobile cold/warm/resume and cross-account switch | Not exercised; automation covers ownership and isolated request caches. |

## Prioritized defect and evidence report

| Priority | Remaining item | Release consequence |
| --- | --- | --- |
| P1 | No physical mobile cold/warm/resume traces or installed-PWA input checks. | Hold production promotion. Capture before/after measurements on the same representative device, network, account and cache state. |
| P1 | No designated authenticated acceptance account for live save → refresh → reopen → retry and account-switch checks. | Live persistence and stale-account acceptance remain open. A success toast, local test, build or READY preview is insufficient. |
| P2 | Numeric UL reference data is absent in production. | Rings remain neutral and explicit; demographic/source-specific warning comparisons require approved reference data. Any production reference/database change needs explicit approval. |
| P2 | PHOENIX photo estimation remains an existing 501/unconfigured feature. | Manual/barcode logging works; actual image estimation is not restored by this release. |
| P2 | Full personalized What's Next still depends on broad history/health inputs, and required reads have no new global timeout. | Authorized starter actions render independently; a stalled required read can retain that shell. Measure before narrowing safety/recommendation inputs. |
| P2 | Middleware identity/membership checks still precede the response. | Possible TTFB floor; inspect authenticated network traces before further auth changes. |
| P3 | Archived uncertain earlier water receipts require review; their eventual status is not automatically reconciled after archival. | Receipt/date/amount are retained locally, with no automatic retry or fabricated save success. |

Fixed during independent review: stale-tab hydration UUID duplication, universal-midnight refresh regression, false demographic UL warning propagation, macro-only micronutrient coverage, direct logger dependency on the full dashboard, and conflicting first-log preparation overwrites.

## Release workflow and device protocol

Use the existing draft [release PR #10](https://github.com/anastasis-elite/Website-v2/pull/10) and its Vercel preview for acceptance. This candidate contains no SQL migration, RLS, billing or entitlement changes. Existing production remains on `f5d2a715`; no production promotion occurred in this task.

On the designated physical device, record browser/OS/PWA mode, account/tier, network and build SHA. Capture at least five cold and five repeat document launches plus five resumes for each build. Record FCP and `anastasis:navigation-to-shell`, `...-primary`, `...-secondary`, and `anastasis:resume-to-secondary`; the shell mark is a two-frame DOM paint proxy, so confirm visible paint and actual action input. Include auth/query/RPC waterfalls, request counts/failures, service-worker controller/cache/update state and median/p95 timings. Do not clear member localStorage, receipts, drafts or IndexedDB to simulate cold starts; use a clean separate test profile or clear only browser-managed static asset caches.

For each allowed save: record prior state, save a unique action, read confirmed state, refresh and reopen the installed PWA, retry the same water identifier, verify unchanged count/total, and check dashboard guidance. Switch designated accounts and verify no prior member data appears. Check all tiers, editable meals, missing/partial micronutrients, installed-PWA update consent and individual module failure recovery. Promote only the tested deployment after these gates pass. Request explicit approval before any production database, billing or entitlement change.
