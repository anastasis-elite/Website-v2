# PR #10 release-readiness review — October 14, 2026

**Decision: HOLD; keep PR #10 draft.** The requested statement that no unresolved P0/P1 issues remain cannot be made. No merge, push, new deployment, production promotion, billing/subscription/entitlement update, or production database write was performed during this review. The Nutrition repair and this evidence are local only until publication is approved.

## Exact release identity and included scope

GitHub reports base `d8877518edd4c9d0efe35421863e5b7ab465ffc2` (`main`) and head `b3bebda38a0b1b6a86432e1f776988260c02ee30` (`codex/coordinated-daily-dashboard`). PR #10 is OPEN, draft, MERGEABLE, and CLEAN. It contains 428 changed files, 55,304 additions and 5,645 deletions across 13 commits. This is the cumulative coordinated release, not only the last 80-file mobile commit. GitHub's diff endpoint rejected the file count above 300; the paginated pull-request-files API supplied all 428 paths, exactly matching the local diff between the reported base/head.

| Intended change | Committed and in PR head | Evidence |
| --- | --- | --- |
| Direct hydration entry | Yes | Shared direct-route helper, dashboard/schedule/What's Next destinations and direct server entry branch; existing water RPC route retained. |
| Direct food/contextual meal entry | Yes | Query intent parsing, dedicated entry view before full personalization, editable meal context and tier-supported distinct methods. |
| Restored slider/presets/manual input | Yes | Shared `HydrationQuickAdd`, 4–64 oz native range, synchronized exact manual input, pressed presets and one confirmation; retained same-ID retries. |
| Micronutrient progress rings | Yes | Accessible reusable SVG; confirmed persisted grams/nutrients, saved individualized targets, actual percentage/units, capped stroke, explicit unknown/partial/macro-only coverage and neutral excess messaging. |
| Black-and-copper identity | Yes | Near-black Today/next-step/dialog/cards/navigation/loading and copper controls/rings; large brown Today gradients removed. |
| PWA loading work | Yes | Request-only context deduplication, streamed shells, parallel reads, independent optional modules, deferred analytics/audit/calendar/charts, exact-asset SW caching and midnight/resume refresh. |

The only initial tracked working-tree change was generated `tsconfig.tsbuildinfo`; pre-existing untracked production catalogs and Supabase temp files remain outside the repair. All six intended mobile features were already committed in the PR at the start of this review.

## Blocking findings

### P1: general Nutrition initialization can overwrite an existing saved day

The PR head's general Nutrition `loadToday` ignores the initial daily-log read error and initializes without `createOnly:true`. A transient read error or a concurrent daily row created during target preparation can invoke the existing update form of `/api/nutrition-log`, replacing targets, legacy meals and completion state. The actual route, executed against a disposable runtime transport, reproduced saved `2100 calories / legacy meal / completed:true` becoming `1800 / [] / false`; saved water remained intact.

The local repair stops initialization on read errors and uses the route's existing create-only option only for first-log preparation. Explicit target-edit semantics remain unchanged. Runtime tests execute the actual preparation route to prove a concurrently created day's targets, water, legacy meals and completion are retained. This P1 is fixed in the local repair; it remains present in the published PR/preview until that repair is pushed and reverified.

The same local repair addresses P2 resume regressions: direct entry adopts a refreshed same-day water row without remounting food drafts; the active logging method and visible micronutrient rings revalidate on resume; older food-list responses cannot replace a newer result. Regression tests cover saved water 8 → 36 oz, preserved logger identity/drafts, active-only resume reads, ignored out-of-order responses, and micronutrient intake 25% → 60%.

### P1: existing commerce source/database incompatibility is carried by the full PR

Production lacks `checkout_purchases`, `stripe_webhook_events`, `client_invitations`, `api_request_events`, the required billing-order columns, commerce readiness/fulfillment/subscription/claim RPCs, and required billing grants. Source/catalog evidence supports checkout failing closed with 503 and valid webhook receipt processing failing with 500 after earlier guards. No payment, portal session or webhook replay was attempted.

Fresh deployment inspection confirms production still runs `f5d2a71578783855f9a1cef39a68f499547327a9`. The examined commerce source files have identical Git blobs at that production source and PR head; this is an existing deployed incompatibility, not a regression introduced by the mobile/PWA commit. It nevertheless prevents the requested zero-P1 gate for the cumulative PR.

The historical July prerequisite performs unrelated customer backfills and can collide with policies already installed by the P0 repair. The October commerce source alone is insufficient. **Do not run `supabase db push` or replay those migrations.** A narrow dependency/grant/function repair requires a separate concrete review and explicit production database/billing/entitlement approval. Alternatively, an explicitly approved mobile-only scope exception must document that the existing commerce P1 remains open; it cannot be reported as resolved by narrowing source scope. See the [database review](pr10-database-compatibility-review-2026-10-14.md).

### Scope disclosure: earlier macro-capability correction

`109501c` changed `nutritionMacroEntry` from true to false for IGNITE and PHOENIX relative to the deployed `f5d2a715` source. Existing server/RLS macro insertion is EMBER-only; food/meal/barcode/photo boundaries remain intact. This is an earlier UI-capability compatibility correction, not a customer subscription or entitlement-record write during this review. The full PR cannot accurately be described as containing no entitlement-logic change. Its intended product behavior needs explicit release sign-off or a separately reviewed scope correction; no capability flag was changed in the local repair.

## Fresh checks and their limits

| Check | Result |
| --- | --- |
| Published PR head web suite | 542 passed, 0 failed/skipped. |
| Local Nutrition repair web suite | **547 passed, 0 failed/skipped.** |
| TypeScript | Passed, including nonincremental check after the final local build. |
| Web lint | Passed with existing warnings; repaired nutrition files separately linted without warnings. |
| Local production build | Passed with explicitly fake local service configuration. No deployment performed. |
| Native calendar tests / TypeScript / lint | 8 tests passed; typecheck and lint passed. Lint reports the existing legacy-config notice. |
| Exact P0 SQL rehearsal | Passed twice against the disposable 56-table reconstruction: owner save/readback, water retry, history preservation, NULL rollback, tier/anonymous/foreign negatives, private calendar isolation and stable reference seeds. No remote/customer data connection. |
| Independent startup review | 79 focused tests passed; no concrete P0/P1 startup regression found. |
| Independent nutrition review | 55 original focused tests and 77 repair/adjacent tests passed; no further concrete P0/P1 in the repaired nutrition scope. |
| Whitespace | Passed for the local repair and review documents. |
| GitHub checks | Vercel SUCCESS and Preview Comments SUCCESS at the published head; Supabase Preview SKIPPED. That skipped check is not database compatibility evidence. |

Fresh production catalog confirms 18 migration entries, latest `20261014133311`. All four applied P0 SQL statements exactly match the reviewed source hashes, despite newer production version identifiers. Hydration RPC signature/security/ACLs, daily uniqueness/receipt column, food/target columns/foreign keys, tiered meal/macro RLS and invoker nutrition views match the mobile application. No new migration is needed for the mobile repair. This catalog evidence does not substitute for authenticated HTTP persistence/schema-cache acceptance.

Numeric nutrient-reference/UL rows remain absent. Photo estimation remains the existing unavailable backend. Optional calendar resume can still issue duplicate focus/visibility reads, and two midnight timers can issue redundant refreshes. Required middleware/personalization can still set a startup floor. These P2 items are detailed in the [startup review](pr10-startup-review-2026-10-14.md).

## Preview and authorized account acceptance

Published preview `dpl_TFwWrpXVUCSHREbh5KgSKNkN4TQ6` is READY at exactly `b3bebda38a0b1b6a86432e1f776988260c02ee30`: [preview](https://website-v2-orrko4m34-youtopiatx-5548s-projects.vercel.app). Production `dpl_H2y47KZPFwoYPfXgWtkzNQN77bVY` remains on `f5d2a715`; no alias/promotion changed. Earlier exact-preview smoke checks recorded login HTTP 200, anonymous dashboard returning login, hydration API HTTP 401, and service worker HTTP 200 with immutable-asset cache policy and no data-clearing operations. READY or anonymous smoke is not authenticated acceptance of the Nutrition repair.

The existing Safari Anastasis tab is signed out at `/login?redirect=/dashboard/program/ignite`. The user was asked to sign in normally; a subsequent UI read still showed the same login state. No credentials were retrieved, session forged, authentication bypassed for the application, customer save attempted, or billing/subscription/entitlement state changed. Authorized live save → refresh → reopen → retry and signed-in preview checks therefore remain open.

## Exact approval-dependent plan

1. Keep PR #10 draft. Resolve the Nutrition publication gate and the commerce zero-P1 gate; obtain sign-off on the earlier macro UI-capability correction. Complete authorized account acceptance. Only then mark the final exact head ready for review. A repair push creates a new preview deployment, so it is withheld under the user's current no-deployment-until-approval instruction.
2. After explicit approval of the final source SHA and release sequence, freshly verify Vercel's production branch/domain-assignment settings and record the rollback deployment/aliases. Confirm a hold on automatic production-domain assignment **before** merging, since the established Git integration can otherwise promote a main-branch merge automatically.
3. Merge only the approved head into `main` with a merge commit. Let the existing Vercel Git integration build that exact merge SHA with production configuration while domain assignment is held; verify READY staged production, source SHA and unchanged live aliases. Do not promote the existing preview as a shortcut to a production-config build.
4. Verify the staged production build's auth/legal/tier routing, direct entry, authorized persisted saves/readback/refresh/reopen, same-ID water retry, rings/missing-data states and optional module recovery. Stop for any P0/P1 failure. Promote only that tested staged deployment within the approved scope, then verify live aliases, saves and error logs. The [startup review](pr10-startup-review-2026-10-14.md) contains scoped commands and settings/rollback checks; none were executed.
5. After production deployment, the user tests the installed iPhone PWA: cold/warm/resume, direct water/food/meal entry, slider/presets/manual input, rings and persisted activity. Record comparable device/network/build/cache conditions, at least five samples per mode, median/p95 visible-shell/input-usable/secondary timings and request failures/waterfalls. Preserve user stores/drafts/receipts. Without a same-device baseline, report after timings and the missing baseline rather than claim improvement.
6. Roll back application traffic to the freshly confirmed pre-release deployment on functional/data-loss/severe startup failure. Do not reverse applied P0 repairs or clear browser data. Keep the PWA performance issue open until actual-device measurements support improvement and acceptance.

The user's current post-production iPhone plan supersedes the older requirement for pre-promotion physical-device timings in prior reports. It does not waive account acceptance, authorize a deployment now, resolve the commerce P1, or permit a performance-resolved declaration from the 24.7% bundle reduction or synthetic loader benchmark.
