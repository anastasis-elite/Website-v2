# PR #10 database compatibility review — 2026-10-14

Read-only review of Supabase project `lcccpqgnpznhbtmkmytp`, PR base `d8877518edd4c9d0efe35421863e5b7ab465ffc2`, and candidate head `b3bebda38a0b1b6a86432e1f776988260c02ee30`. The production application source commit supplied for comparison is `f5d2a71578783855f9a1cef39a68f499547327a9`. Git comparison does not independently prove which deployment currently owns the production alias; the release coordinator must verify that separately.

## Decision

The hydration, direct food/meal entry, micronutrient ring, and daily dashboard code has the required production catalog objects and authorization boundaries. No new production migration is required for those mobile/PWA changes.

The full cumulative PR cannot receive a statement that no P0/P1 issues remain. A **P1 existing commerce/database incompatibility** remains: deployed-source checkout, webhook, purchase verification, invitation, and billing-management paths depend on missing schema and grants. Those commerce files are identical at `f5d2a715` and this candidate; this review does **not** attribute the incompatibility to the new mobile/PWA commit. It remains relevant because the PR includes those changes relative to its older base and the release request requires an absence of unresolved P1 defects.

No migration, policy, billing configuration, subscription, entitlement, or customer record was modified. Catalogs, migration history, table/column ACLs, function definitions, reference-table counts, and security advisors were read. No member health values were selected.

## Fresh catalog evidence

At **2026-10-14 19:12:56.699792 UTC**, production ran PostgreSQL 17.6 and had **18 migration entries**, latest version `20261014133311`. The four P0 repair migrations are present under the MCP-assigned production versions below. For each, `md5(array_to_string(statements, E'\n'))` matches the MD5 of the entire committed local file, and local SHA-256 matches the committed manifest. Each production history entry stores one statement string containing the exact SQL file.

| Production version / name | Committed local source | Exact MD5 | Manifest SHA-256 |
| --- | --- | --- | --- |
| `20261014124313` / `p0_hydration_submission_integrity` | `20261013195246_p0_hydration_submission_integrity.sql` | `b37246a8efcf99268f76c97392d62698` | `c8864203b04c118a7c7b2b0248eff59dd1d27e0e177b2d9041cc7fcec11c8dce` |
| `20261014124831` / `p0_daily_save_foundation` | `20261014012428_p0_daily_save_foundation.sql` | `ab82f7d6a5c4f9b2f00777fa01f40e1d` | `65ace8441b6f91b4a1c6cb53e1d00d88026c3845fa9424b3eeaa3c453c197e6e` |
| `20261014125833` / `p0_connected_calendar_dependencies` | `20261014023155_p0_connected_calendar_dependencies.sql` | `64956856d6c73a0e0c4f94824cba75f6` | `8270006074fcfa0af7dcf33c6049d3584795d34537e6865c7e91980fae3cfa67` |
| `20261014133311` / `p0_daily_guidance_progress_metadata` | `20261014023157_p0_daily_guidance_progress_metadata.sql` | `ce78de76c5ee485301a172a5cf8adeed` | `37a9934d0a05c0f279a0dea22218c68512458b1333a50275d5218ea66c16e921` |

The previously committed repair release document and manifest say `prepared_not_applied` and report 14 migration entries. They are historical preparation evidence, superseded for current production status by this read-only catalog sample and the existing postmigration catalog artifact. Do not interpret those old documents as authorization to apply the files again. Production version identifiers differ from local filenames; blind `supabase db push` is inappropriate.

## Mobile logging and daily dashboard compatibility

- `public.add_daily_water(p_log_id uuid, p_ounces numeric, p_submission_id uuid)` returns `jsonb`, is SECURITY INVOKER, and uses `search_path=public,pg_temp`. Authenticated EXECUTE is allowed; anonymous and service-role EXECUTE are denied. Its definition validates `auth.uid()`, member/client ownership, positive finite amounts, and a non-null submission UUID; row-locks the daily nutrition log; returns the saved log on repeated UUIDs; and adds the amount/UUID together. Definition MD5: `8295d2e8047d6f70fa53e5219696f666`.
- `nutrition_logs.water_submission_ids` and all direct-entry/water/target columns exist. `nutrition_logs_client_id_log_date_key` enforces `UNIQUE(client_id,log_date)`.
- `replace_daily_commitments(p_client_id text,p_blocks jsonb)`, `replace_workout_sets(p_session_id uuid,p_sets jsonb)`, and `save_daily_workout(p_client_id text,p_day_start timestamptz,p_day_end timestamptz,p_payload jsonb)` exist with authenticated-only EXECUTE and invoker semantics. New workout timestamps coexist with retained legacy DATE history.
- The custom-food invoker RPC exists with the application's exact 15 arguments. `foods`, `food_nutrients`, `food_serving_options`, `meal_entries`, `macro_entries`, and `meal_symptoms` have RLS enabled and the needed authenticated grants. Anonymous SELECT is denied.
- Meal RLS requires the caller's owned nutrition log and client, IGNITE/PHOENIX membership, a readable matching food and serving, valid positive amounts/grams, and PHOENIX for `photo_estimate`. Macro INSERT remains EMBER-only. Restrictive meal-symptom ownership policies close broader legacy permissive policies.
- All tracked food nutrient fields and saved daily target columns needed by `loadMicronutrientProgress` exist. The foreign keys for meal-to-food, nutrient-to-food, serving-to-food, and reference-to-nutrient relationships exist, supporting the PostgREST nested reads.
- `nutrition_log_remaining`, `nutrition_log_totals`, and `nutrition_log_totals_by_block` have `security_invoker=true`; authenticated SELECT is allowed and anonymous SELECT is denied. Their meal-only aggregation is reconciled with saved macro entries by the application helper.
- `protect_member_entitlements` is installed as a BEFORE INSERT OR UPDATE trigger on `clients`; ordinary authenticated callers cannot change protected membership/entitlement fields.
- Calendar connection/synchronization objects exist. Credential, OAuth-state, and write-operation tables have RLS and deny authenticated CRUD. Calendar lease/disconnection RPCs grant service-role EXECUTE only.

At **2026-10-14 19:15:15.989155 UTC**, `nutrient_reference_values` contained **0 total rows and 0 UL rows**. Numeric upper-limit comparison is therefore unavailable in production. This is the existing P2 limitation: rings must remain neutral, disclose unavailable references, and describe above-target intake without presenting excess as an achievement. No numeric reference values were invented or inserted.

Security advisor sampled **2026-10-14 19:13:00.491 UTC** reported seven informational `rls_enabled_no_policy` findings for intentionally private calendar/social tables and one existing warning for disabled leaked-password protection. No new schema WARN/ERROR was returned. The private-table findings are not a reason to grant member access. Advisor remediation references: [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## P1: existing commerce dependencies are absent

Catalog sample **2026-10-14 19:14:43.027521 UTC** returned NULL for:

- `public.checkout_purchases`, `public.stripe_webhook_events`, and `public.client_invitations`;
- `public.commerce_configuration_ready()`;
- `public.fulfill_checkout_purchase(jsonb)`;
- `public.sync_member_subscription(text,jsonb)`;
- `public.claim_checkout_purchase(text,uuid)`.

`client_billing` exists but lacks `last_checkout_created_at` and `last_subscription_event_created`. Follow-up catalog inspection also confirmed `api_request_events` is absent. At **2026-10-14 19:27:18.199342 UTC**, `client_billing` had RLS disabled but no anonymous or authenticated SELECT/INSERT/UPDATE/DELETE privileges. Service-role SELECT/INSERT/UPDATE/DELETE are also absent. This review does not establish a current public billing disclosure; the missing server grants are an additional functionality dependency. `clients` does have service-role CRUD.

| Caller and trigger | Expected behavior against this catalog | Source |
| --- | --- | --- |
| Checkout POST after environment checks | Missing readiness RPC forces 503 before a Checkout session is created | `app/api/checkout/route.ts:16` |
| Valid Stripe webhook after signature/environment checks | Missing receipt-table SELECT throws; handler returns 500 | `app/api/webhooks/stripe/route.ts:21` |
| Purchase fulfillment / subscription synchronization | Missing RPCs prevent purchase activation and subscription access synchronization | `lib/commerce/fulfillment.ts:60`, `:77` |
| Authorized returning purchase verification | Missing claim RPC prevents receipt-to-account association | `app/verified/page.tsx:35` |
| Guest purchase invitation | Missing invitation/rate-limit tables prevent invitation creation/delivery tracking | `lib/commerce/invitationDelivery.ts:8`, `lib/auth/rateLimit.ts:23` |
| Account billing portal | Authenticated billing read lacks SELECT privilege and returns an unavailable state | `app/api/billing/portal/route.ts:13` |

These are source/catalog inferences, not injected live Stripe events or real payment attempts. Existing production environment variables may short-circuit some routes earlier. No payment or portal session, webhook replay, invitation message, subscription change, or entitlement update was attempted.

### Attribution: already present at the supplied production source commit

The following files have identical Git blobs at `f5d2a715` and candidate `b3bebda3`, while differing from or being absent at PR base `d8877518`:

| File | Blob at production source and candidate |
| --- | --- |
| `app/api/checkout/route.ts` | `4e1f46de535f9092895550fe9626f23aa47c04e4` |
| `app/api/webhooks/stripe/route.ts` | `62481ae40030ff1d826f3c1f1234c1d938ef9203` |
| `lib/commerce/fulfillment.ts` | `33db0b55667292f929765f539dcd0d74532bc1ff` |
| `lib/commerce/environment.ts` | `1c8207d234003b1c5abe4e5409d6f481697dded1` |
| `lib/stripe/fulfillCheckout.ts` | `848acef9cdb7eb76295eea2a340b6bb196fbd0fa` |
| `app/verified/page.tsx` | `3f0d991e59bb8dff2ac076d51ca2ea8f94cff788` |
| `app/api/billing/portal/route.ts` | `487de111195aeb711028fc6a07486e30008574b9` |
| `supabase/migrations/20261012174637_secure_checkout_fulfillment_and_billing.sql` | `bdb45cf99de79a350f9dc49709d633336ff1269a` |

Thus the latest mobile/PWA work introduces **no additional commerce source change** relative to the supplied production source. Narrowing the diff to the mobile/PWA changes would make release scope clearer but would not itself repair the existing production commerce problem.

### Missing prerequisite and why raw migration replay is unsafe

`supabase/migrations/20260708_launch_readiness_profiles_payments_rls.sql` defines `client_invitations` at line 53, `stripe_webhook_events` at line 64, and `api_request_events` at line 72. It enables their RLS, grants server-only access, enables billing RLS, adds an owner billing-read policy, and grants authenticated billing SELECT. This historical source already exists at PR base; its production migration version is absent.

The July file also creates profile/schedule policies that the four P0 repairs have already installed and contains customer onboarding/profile backfills. Raw replay can collide with existing policy names and would execute unrelated customer writes. It must not be applied as a shortcut.

`supabase/migrations/20261012174637_secure_checkout_fulfillment_and_billing.sql` starts by altering the absent invitation table, adds payment ledgers and the billing-order columns, and defines the missing commerce RPCs and billing-protection trigger. It is absent from production migration history. Its `commerce_configuration_ready()` returns constant `true`; it must be installed only after all dependencies/grants actually exist. Neither this file nor the July source grants the currently missing service-role privileges on existing `client_billing`, so simply applying both is not sufficient without a fresh permission review.

Exact source SHA-256 hashes:

- July prerequisite: `60ffdb653ba4f940895dac5090b1ddafd29be5fc116d3cfcc12723158f630893`.
- October commerce file: `b1fc2a8cc0161f6418edc6ee795b0def46fc5932ee0809c3dbc101a23119ee86`.

### Reviewable correction options; none executed

1. **Resolve commerce in a separately approved repair before asserting the requested zero-P1 gate.** Prepare one dependency-ordered, idempotent repair containing only missing invitation/rate-limit/receipt/ledger objects, billing columns/indexes, owner billing-read RLS, server billing grants, reviewed commerce functions and protective triggers. Avoid July customer backfills and unrelated profile/schedule policies. Validate synthetic purchase/claim/webhook replay, event ordering, duplicate/foreign-account denial, server/member privilege boundaries, and unchanged existing customer entitlements in an isolated reconstruction. Obtain explicit production database/billing/entitlement approval before applying any such repair. Verify real test-mode payments only with an explicitly isolated test database and authorized Stripe test configuration.
2. **Separate the mobile/PWA scope from historical cumulative work.** Use a narrowly based release diff against verified production source, preserving the deployed commerce code and its existing fail-closed behavior. Carry this existing P1 in the report. This option can show no new mobile regression but does not meet the user's current requirement that no unresolved P1 remains; an explicit user-approved scope exception would be needed before releasing with it.

Do not revert commerce to the older base automatically: that earlier implementation trusts weaker purchase ownership and lacks the new safety controls. Do not enable checkout by bypassing readiness checks or weakening access boundaries. Neither option authorizes production writes or a merge/deployment.

## Verification limits

Catalog presence, exact migration matching, RLS/grants, and foreign keys establish database contract compatibility. They do not prove PostgREST cache discovery or live authorized save/readback, installed-PWA persistence, account switching, or physical-device cold/warm/resume timings. The existing-account browser review and iPhone acceptance protocol remain separate evidence. Synthetic SQL/browser fixtures and reduced bundles cannot establish that PWA performance is resolved.
