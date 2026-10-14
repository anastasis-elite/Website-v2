# PR #10 startup and PWA release-readiness review — October 14, 2026

Read-only application review of [PR #10](https://github.com/anastasis-elite/Website-v2/pull/10), base `d8877518edd4c9d0efe35421863e5b7ab465ffc2` and head `b3bebda38a0b1b6a86432e1f776988260c02ee30`. This is the exact head inspected and tested; subsequent code changes require verification against their new SHA. Creating this report changes documentation only. This reviewer did not merge, deploy, promote, change project settings, or write database/customer data.

**Verdict:** no reproducible P0/P1 startup regression found in the inspected changes. Startup implementation can proceed to review readiness if the integrated exact-SHA checks, authenticated preview and database/persistence review pass. Actual iPhone performance and installed-PWA acceptance remain open. No timing goal or resolved-performance claim is supported by this review.

## Verified implementation

| Boundary | Code evidence and implication |
| --- | --- |
| Immediate shell | `app/dashboard/layout.tsx` streams a nonpersonal `DashboardLoadingShell`; it contains no saved member information. Middleware authentication/membership still precedes the response. |
| Authorized primary actions | `app/dashboard/program/[program]/page.tsx` obtains verified member context, confirms subscribed tier and checks recent safety flags before exposing `DashboardReadyShell`. The authenticated layout retains its legal acceptance gate. Starter actions point to check-in and direct entitled water/food entry. |
| Member context deduplication | `lib/dashboard/getDashboardContext.ts` uses React request-scoped `cache` for verified identity. Each caller independently enforces its access and onboarding requirements. No cross-request member cache is introduced. |
| Daily loading | `lib/day/getDailyExecutionPlan.ts` and `lib/dashboard/logic/loadProgramLogicInputs.ts` parallelize independent reads. `lib/schedule/service.ts` reuses the loaded daily plan, parallelizes schedule sources and bounds optional dashboard schedule reads at two seconds. Missing sources remain explicit; unverified free windows and rescheduling controls are removed. Schedule mutations reject incomplete source state. |
| Deferred audit | The dashboard uses Next `after` to move recommendation-audit transport outside startup. `lib/legal/logRecommendationAudit.ts` still verifies current authenticated identity and client ownership before constructing its privileged append transport; failure is handled without exposing recommendation inputs or rejecting daily UI. |
| Lazy and optional work | Detailed calendar code and requests mount on disclosure; a local error boundary offers the full details route. Charts mount only with their disclosure. Deferred analytics uses a bounded memory queue and optional failures do not reject daily actions. |
| SW and update safety | `public/sw.js` caches exact static assets, including deployment query identity. Authenticated HTML, API writes/reads, RSC and cross-origin requests remain uncached. It retains earlier assets and does not clear localStorage, receipts, drafts, IndexedDB or other caches. Updates wait for closure or explicit consent; only the screen applying the update reloads. Invalid asset MIME types cannot return cached HTML as JavaScript/CSS. |
| Resume and day changes | Passive full-dashboard refreshes coalesce. Layout midnight refresh covers every dashboard page, including background-to-visible resume; schedule/daypart/event timers handle member timezone and DST. Minute polling is removed. |
| Measurement | Local User Timing records shell/primary/secondary and dashboard resume completion. Shell timing after two animation frames is a DOM paint proxy, and primary timing needs an actual input check. Full-document launches are required for startup measurements; SPA navigation is not a cold launch. |

## Tests independently rerun

**79 passed, 0 failed, 0 skipped**, at the inspected head. These use disposable/mocked transports and do not constitute real production or device acceptance.

```sh
node --test tests/dashboardStartup.test.mjs tests/dashboardRefresh.test.mjs tests/dashboardClockRegression.test.mjs tests/pwaRecovery.test.mjs
node --test tests/recommendationAuditAuthorization.test.mjs tests/scheduleEngine.test.mjs tests/scheduleRecommendation.test.mjs tests/calendarFlow.test.mjs tests/calendarRecipesDailyInsight.test.mjs
```

The first command passed 30 tests for request identity/account isolation, source concurrency/stalls, timer cleanup, hidden resume, midnight/DST and SW/cache/update behavior. The second passed 49 tests for audit authorization, schedule recommendation/action consistency, incomplete source rejection and owner-scoped calendar operations. Root release verification owns full tests, TypeScript, lint, build, authenticated saves and the exact preview/deployment checks.

## Remaining P2 items and measurement limits

| Item | Evidence and practical limit |
| --- | --- |
| Optional expanded-calendar resume duplication | `lib/calendar/client.ts:58–62` separately fetches for focus and visibility. Full server refresh coalescing does not deduplicate those optional requests. The calendar is mounted on demand; this is a performance follow-up, with no demonstrated save/ownership failure. |
| Possible double midnight refresh | `components/DailyPlanRefresh.tsx:20` always refreshes as a saved event; `lib/schedule/client.ts:30` also refreshes at the schedule's midnight boundary. If the child timer runs first, the layout refresh can follow it. This is extra work, not a demonstrated lost save. |
| Required startup floor | Middleware checks still block the first response; broad personalization reads have no new global timeout. Starter actions can render while the personalized day waits. Actual network/device traces are necessary to identify the remaining dominant cost. |
| Real-device evidence | No physical iPhone cold/warm/resume run was performed by this reviewer. Existing bundle and simulated loader results measure size/orchestration only. |

The user's current instruction explicitly places installed iPhone testing **after an approved production deployment**. This supersedes the older pre-promotion physical-device gate in prior release reports. It does not waive authenticated preview/persistence checks, authorize a deployment now, or permit a performance-resolved declaration before measured device improvement.

## Approval-dependent merge, staging, promotion and rollback

Fresh root Vercel inspection reports team `team_9IlTosdiNM1LIWUEalcToj38`, project `website-v2` / `prj_t7uI7hI0KMynF4hkh0iEbmyKpOUH`, current production `dpl_H2y47KZPFwoYPfXgWtkzNQN77bVY` at `f5d2a71578783855f9a1cef39a68f499547327a9`, and READY preview `dpl_TFwWrpXVUCSHREbh5KgSKNkN4TQ6` at the inspected PR head. This reviewer independently confirmed the project/team and READY preview through `get_project`. The connector omits Git branch tracking and automatic domain assignment settings. Historical repository evidence identifies `main` as the production Git branch; it must be rechecked before release.

The repository has no GitHub Actions deployment workflow and no local `.vercel` link. `vercel.json` currently configures only the existing calendar cron. Preserve the established Vercel Git integration rather than assume there is a separate CI approval gate. Vercel normally promotes production-branch merges automatically; `--skip-domain` on a later CLI deployment alone cannot protect against the merge-triggered Git deployment. [Vercel promotion workflow](https://vercel.com/docs/deployments/promoting-a-deployment), [CLI staging option](https://vercel.com/docs/cli/deploy#skip-domain).

1. **Now:** keep the candidate and preview under review. Do not merge, push a repair that triggers a new deployment, create any deployment (including preview/staged production), change deployment settings or promote until the user approves the final release. Approval must cover the final head SHA and the staging/promotion sequence below. Database, billing and entitlement changes require separate explicit approval; this plan includes none.
2. **After final approval, before merge:** recheck the exact PR SHA, base SHA, checks and target team/project. Record the current production deployment/aliases as the rollback target. In Vercel Production → Branch Tracking verify `main`, record the current **Auto-assign Custom Production Domains** value, turn it off for staging and confirm production aliases still point to the existing deployment. Do not merge if that hold cannot be confirmed.
3. **Merge the approved head:** use a normal merge commit to retain the reviewed release history. Record the resulting merge SHA. Allow Vercel's existing Git integration to build that merged SHA with production configuration, with automatic domain assignment held off. Confirm the result is READY, production target and staged, with matching source SHA and no production alias moved. If Git does not create the deployment, a correctly linked clean checkout at that exact merge SHA can use `vercel deploy --prod --skip-domain --scope team_9IlTosdiNM1LIWUEalcToj38`; first verify the linked project and installed CLI help. Never upload this shared workspace with untracked audit files or temporary build/configuration data.
4. **Verify the staged production build:** inspect exact SHA/environment/build logs; check legal/auth/tier routing, direct entry, authorized persistence → refresh → reopen, identical water retry without duplicate activity, micronutrient/missing-data display, static asset loading and optional failure recovery. Confirm the live domain still serves the recorded rollback build. A READY build is insufficient by itself. Stop on any P0/P1 regression.
5. **Promote only the tested staged production deployment:** run `vercel promote <verified-staged-production-deployment-url-or-id> --scope team_9IlTosdiNM1LIWUEalcToj38` within the approved release scope. Do not promote the preview: that would rebuild with production configuration. Verify current aliases, exact SHA, core saves and error logs immediately afterward. Recheck automatic domain assignment after promotion and restore the recorded desired policy only when consistent with the approved workflow.
6. **iPhone acceptance after production:** perform the protocol below. Keep PWA performance open until comparable actual-device results demonstrate improvement. Functional failure, data loss or severe startup regression is a rollback trigger; a missed speed target remains an explicitly reported performance defect.
7. **Rollback:** if a release trigger fails, use `vercel rollback dpl_H2y47KZPFwoYPfXgWtkzNQN77bVY --scope team_9IlTosdiNM1LIWUEalcToj38`, provided the pre-release check still confirms that exact prior deployment. Confirm production aliases and hydration/save behavior afterward. Rollback changes application traffic only; do not reverse applied database repairs or clear user stores. Vercel rollback disables automatic domain assignment, so verify that state and keep further promotions deliberate. [Vercel rollback guidance](https://vercel.com/docs/instant-rollback).

Command placeholders are populated only after the user approves and the deployment identity is verified. No commands in this section were executed by this reviewer.

## Post-deployment iPhone acceptance protocol

Record iPhone model, iOS/Safari version, installed-PWA versus Safari mode, account/tier, network, exact build SHA, service-worker controller/cache/update state and visible recording. Use the existing authorized account without changing subscription, billing or entitlements. Keep all existing activity, local receipts and drafts.

- Capture at least five cold launches, five warm launches and five resumes on a consistent network. Cold means a fresh document/PWA launch; use separate clean browser-managed asset cache state if necessary, never deletion of member localStorage/IndexedDB. Record median and p95 shell-visible, primary-input-usable and secondary-content times, FCP and the `anastasis:*` measures. Include failed requests, timeouts, auth/query/RPC waterfalls and request counts. The two-frame shell mark alone does not prove visible paint or usable input.
- Compare with a recorded prior-build run on the same device, account, network and launch definition. If no same-device baseline exists, report measured after-release times and the missing baseline; do not label that an improvement. The shell ≤1s, primary ≤2s and secondary ≤3s repeat-visit goals remain unverified until these runs.
- Open Log Water directly, synchronize preset → slider → exact manual input, confirm one save, reopen/refresh and verify persisted totals. Retry the same water submission identifier and verify no duplicate activity/count. Open Log Food/Meal directly, check editable contextual meal and allowed distinct methods, save once and confirm persisted food/activity after reopen.
- Check micronutrient actual/target units and percentages, capped ring with actual text above 100%, incomplete/missing/no-food states, and neutral upper-limit handling. Confirm near-black/copper panels, slider, rings, navigation and loading states.
- Resume across a local-day boundary, verify current-date activity, exercise the explicit PWA update while preserving drafts/receipts, and confirm an optional module failure does not remove primary actions. Account-isolation/tier-denial checks use only separately authorized accounts/fixtures; do not alter this user's entitlements to manufacture tiers.

Document failures with build, account/tier, steps and evidence. Do not close the PWA performance issue merely because tests, builds, a success toast or synthetic benchmarks pass.
