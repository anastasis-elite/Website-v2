# PR #10 blocker resolution and release decision — October 14, 2026

**Decision: HOLD.** Local application repairs and two tested SQL proposals are ready for review. Required production repairs remain unapplied, the final repaired source has no deployment preview, and authenticated acceptance is incomplete. The current constraints prohibit the database permissions and deployment changes needed to close those gates. No merge, push, deployment, billing/subscription change, production permission change, customer health write, or authentication bypass was performed.

## Macro capability investigation

The earlier change is in `109501c96e0aaf7cd6a76b832c7219af42cd772f`: IGNITE and PHOENIX `nutritionMacroEntry` changed from `true` to `false`; EMBER stayed `true`. Their separate meal and barcode capabilities stayed enabled, and PHOENIX kept its photo and expanded nutrition capabilities.

History supports an intentional correction to the established API/database contract, rather than removal of IGNITE/PHOENIX food logging:

| Source | Meaning |
| --- | --- |
| `621592d` / August design | EMBER macro-only totals; IGNITE/PHOENIX meal logging with their macro-only flags false. The August macro INSERT policy is EMBER-only. |
| `663f265` / September expansion | Enabled higher-tier macro flags without widening the EMBER-only macro database policy. Also briefly enabled EMBER meal/barcode flags. |
| `f79f9aa` / October correction | Restored EMBER's no-meal/no-barcode boundary. |
| `109501c` / P0 repair | Restored higher-tier macro flags to false, matching the original model and existing macro API/RLS. The published higher-tier food logger remains available. |

`nutritionMacroEntry` controls aggregate macro-only intake, not logging a food or meal. The established EMBER macro-total path is retained as distinct from food/meal logging; it does not create a canonical `meal_entries` row. This interpretation follows the repository's August policy and existing product/tutorial documentation. No member entitlement record, subscription, or billing state was changed during this investigation.

| Tier | Preserved product behavior |
| --- | --- |
| EMBER | Personalized guidance, hydration and established aggregate macro totals; no food/meal/manual-food/barcode/photo logging. |
| IGNITE | Authorized manual and barcode food logging; no PHOENIX photo method. |
| PHOENIX | Expanded nutrition and manual/barcode methods; photo entitlement stays enabled, subject to supported estimator availability and reviewed confirmation. |

## Server enforcement and newly discovered gaps

Protected nutrition API paths run through middleware that verifies the Supabase user and stored active membership. Logging handlers resolve the owned client and use its stored program, not caller-supplied tier or editable user metadata. Canonical meal INSERT RLS checks owned log/client, supported tier, readable food/serving and PHOENIX for `photo_estimate`; macro INSERT is EMBER-only. The production `protect_member_entitlements` trigger prevents ordinary authenticated members from changing protected access fields.

This is not a blanket assertion that current production enforcement is complete. Read-only catalog evidence confirmed that `nutrition_logs.meals` legacy JSON and recurring-food preferences have ownership checks without the necessary additional food-tier restriction. The legacy nutrition preparation API also accepted nonempty meals for EMBER. Direct database nutrition mutations lacked the API middleware's active-membership boundary. The local API fix rejects EMBER nonempty meal submissions, validates the meal payload, and omits unspecified meals/EMBER empty arrays so target edits preserve historical intake. A separately approved database guard is still required for direct Data API writes.

Independent read-only production inspection at `2026-10-14 21:45:18 UTC` also found `food_log_items` with RLS disabled and historical `TRUNCATE`, `REFERENCES` and `TRIGGER` grants to anonymous and authenticated roles. The nutrition proposal now revokes these privileges from `PUBLIC`, `anon` and `authenticated` before enabling its restrictive policies. `TRUNCATE` bypasses RLS, so enabling RLS alone would leave that administration privilege intact. A real SQL regression confirms both browser roles are denied truncation and the retained synthetic history is unchanged, even with inherited historical broad grants. No production changes were made during this inspection or test.

## Exact local changes

| Files | Concrete change |
| --- | --- |
| `app/api/nutrition-log/route.ts` | Reads program from the owned stored client; rejects EMBER meal writes with 403 and malformed meal payloads with 400; preserves existing legacy meals when targets are edited without meal input and when EMBER submits an empty meal array. |
| `lib/entitlements.ts` | Documents the aggregate-macro versus food/meal distinction. No capability value is changed in this follow-up. |
| `docs/sql/pr10-nutrition-entitlement-guard.sql` | Unapplied transactional SQL proposal: invoker helper matches owner/tier/active access/expiry; legacy-meal trigger prevents unauthorized new/changed JSON while preserving previous data; restrictive INSERT/UPDATE/DELETE policies for meals, macros, recurring preferences, custom foods/nutrients/servings, symptoms and legacy food items. Enables RLS on guarded tables; keeps existing SELECT/history access and adds no permissive write grant. |
| `app/verified/page.tsx` | Requires confirmed login email from server `auth.getUser()` before claim; sends it to the new three-argument server-only claim RPC, eliminating the need for broad service-role `auth.users` SELECT. |
| `app/api/checkout/route.ts` | Requests commerce contract version 2 so older source cannot accidentally open checkout against the changed claim contract. |
| `docs/sql/pr10-commerce-dependency-repair.sql` | Unapplied transactional dependency/grant/owner-read repair, reused reviewed invoker fulfillment/event-ordering logic, validated purchase fields, server-only ledgers/invitations/rate-limit receipts, billing protection and confirmed-email claim. Readiness checks actual dependencies/privileges and version 2; the old zero-argument readiness call returns false for safe rollout. Retains the existing P0 entitlement trigger and performs no customer backfills or broad auth-table grant. |
| `tests/nutritionDailyPersistence.test.mjs`, `tests/purchaseConfirmationOwnership.test.mjs`, `tests/paymentFlow.test.mjs`, `tests/pr10ReleaseSql.test.mjs` | Actual route/page tests and real SQL negative/positive/replay tests against the captured 56-table fixture plus applied P0 files. Tests are synthetic and have no network or customer-data connection. |

These SQL files are review proposals in `docs/sql`, not migration-history entries. The required CLI migration workflow stalled because its telemetry write requested access outside the writable workspace; that attempt was interrupted. No migration filename/history was fabricated. After approval, a generated migration must contain the exact reviewed SQL rather than blindly replay historical migrations.

Reviewed proposal SHA-256:

- Nutrition: `d66decc34d9fd178466a200decafc303c31eb828bc3fac33c1fb9d85d5171664`.
- Commerce: `3611bbc1ae7596b4cc52743eb3edaa2615604b01e58edb967ae2251ba3817f2a`.

The working source is local `411e4c3` plus these uncommitted repairs. The pre-existing generated `tsconfig.tsbuildinfo`, two production catalog files and `supabase/.temp` were not included or removed. No new release SHA is claimed.

## Existing commerce blocker

Fresh read-only production inspection at `2026-10-14 20:20:38 UTC` still found 18 migrations, latest `20261014133311`, and no `checkout_purchases`, `stripe_webhook_events`, `client_invitations` or `api_request_events`. The prior database report also identifies missing billing-order columns, readiness/fulfillment/subscription/claim RPCs and billing grants. A fresh aggregate count found no duplicate billing client IDs; no billing/customer records were returned. Service-role SELECT on `auth.users` is absent, exposing another dependency of the older invoker claim function.

The missing readiness RPC makes checkout fail closed before creating a payment. Missing webhook receipt/schema dependencies remain an operational P1. These are carried existing defects relative to the currently deployed `f5d2a715` source. They cannot be resolved in production without the schema/permission changes explicitly excluded by this request. No live payment, portal session, webhook replay, invitation, customer backfill or entitlement synchronization was attempted.

The repair must be dependency-ordered and separately approved, excluding the historical July customer backfills and policy collisions. Do not run blind `supabase db push` or replay the old July/October migrations as a shortcut.

## PHOENIX image acceptance

The image entitlement remains PHOENIX-only. Current `photo-estimate` GET unconditionally returns `available:false`; a valid authorized POST unconditionally returns HTTP 501. The route has no estimator integration, so adding environment variables or deploying does not make it functional. Existing tests intentionally validate this unavailable-provider response and canonical insertion of a pre-resolved photo candidate; neither proves image recognition. Functional image logging remains an acceptance gate for the stated PHOENIX experience. No new provider, health-image transmission or billing integration was introduced.

## Preview identity, account preparation and limits

PR #10 remains OPEN and draft at remote head `b3bebda38a0b1b6a86432e1f776988260c02ee30`. GitHub reports Vercel success and Supabase Preview skipped; the skipped check is not database compatibility evidence. Local source already starts from the additional Nutrition preservation repair `411e4c3249a41b5f716eccafdc6a96fb454d3730`.

The existing [preview](https://website-v2-orrko4m34-youtopiatx-5548s-projects.vercel.app) is READY at `b3bebda`, deployment `dpl_TFwWrpXVUCSHREbh5KgSKNkN4TQ6`. It cannot certify local `411e4c3` or subsequent repairs. Production remains on deployment `dpl_H2y47KZPFwoYPfXgWtkzNQN77bVY`, source `f5d2a71578783855f9a1cef39a68f499547327a9`; no alias/promotion changed.

The existing Safari Anastasis tab was signed out. A new Safari tab was opened to the exact preview login/direct-program destination; it reached Vercel's normal login gate. The user was asked to sign in normally through Vercel, then Anastasis with the existing authorized account. No credentials were retrieved, session forged, bypass URL minted, or protection disabled. Authenticated acceptance remains pending unless explicitly recorded below.

The public Supabase configuration is shared between preview and production and points to `lcccpqgnpznhbtmkmytp`. Preview health saves would be real account writes. Live checks remain read-only while the older preview lacks the saved-day repair. No billing, subscription or membership modification is necessary or authorized for account testing. The final repaired preview requires separate deployment authorization, because the current request forbids deployment.

## Validation and remaining risks

Final post-edit checks:

| Check | Result / limit |
| --- | --- |
| Full web suite (`npm test`) | **561 passed; 0 failed, canceled, skipped or todo.** Includes 10 new real-SQL checks for both proposals. |
| Web TypeScript | Nonincremental check passed. |
| Web lint | Passed with existing warnings. |
| Original exact P0 rehearsal | Passed; all four P0 files applied twice to the captured 56-table reconstruction, with owner saves/readback/retry, history/NULL rollback, ownership/anonymous/tier negatives, private calendar isolation and stable reference seeds. |
| New repair SQL | Both proposals applied twice; unchanged pre-existing synthetic billing/entitlements; EMBER canonical/legacy/custom/recurring denials, IGNITE manual/barcode plus photo denial, PHOENIX canonical photo candidate, inactive/revoked/expired negatives, server-only commerce, owned billing reads, atomic/idempotent fulfillment/claim, event ordering and fail-closed/versioned readiness passed. An intentionally permissive historical legacy-item grant/policy was added only to the disposable fixture to verify restrictive RLS survives it. |
| Native calendar / types / lint | 8 tests passed; nonincremental TypeScript and lint passed, with the existing legacy-lint notice. |
| Whitespace | `git diff --check` passed. |
| Production build | Passed with fake Supabase/Stripe/Resend local service settings only; no credentials or remote account connection, no deployment. |
| Live preview/account | Exact old preview identity and authentication gate confirmed. No final-source preview or authenticated save/readback acceptance. |

Independent baseline review also passed 79 startup/PWA/schedule/audit tests and 66 outage/persistence/API/workout-date/onboarding/SQL/calendar/security/consent tests, finding no additional concrete P0/P1 outside nutrition and commerce. A fresh independent reviewer of the final proposals remains advisable before production application. Synthetic tests do not establish live account behavior.

Remaining required gates: apply approved database repairs and confirm actual RLS/ACL/cache discovery; resolve functional PHOENIX image acceptance; publish/create a preview of the final reviewed source after authorization; complete existing-account save/readback/refresh/reopen/retry acceptance.

Remaining follow-ups: installed-iPhone cold/warm/resume timings; absent numeric nutrient/UL reference rows; duplicate optional calendar/midnight refreshes; required middleware/personalization startup floor; connected-calendar provider acceptance; older multistatement daily-save partial-write and append retry limits. The security advisor still reports the existing disabled leaked-password-protection warning plus seven informational findings for intentionally private calendar/social tables. None was changed under the prohibition on production permissions.

The [production release checklist](pr10-final-release-checklist-2026-10-14.md) contains the concrete gates, authenticated test protocol, approved staging sequence and rollback plan. The [preflight evidence](pr10-blocker-production-preflight-2026-10-14.json) records metadata without customer health data or credential values. The checklist remains on HOLD until required gates are satisfied and the user approves the exact release.
