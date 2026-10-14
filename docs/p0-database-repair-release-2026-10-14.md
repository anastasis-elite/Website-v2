# Anastasis P0 database repair — release review

Prepared and locally validated; production remains unrepaired and this release is not operationally certified. No production DDL, customer record writes, deployment, or provider event changes occurred.

## Production root causes and evidence

The Vercel production configuration points to Supabase `lcccpqgnpznhbtmkmytp`. A final read-only catalog check still reports 14 migration entries, newest `20261008222108`, no function named `add_daily_water` in any schema, and no `nutrition_logs.water_submission_ids` column. The three other daily save RPCs are absent too.

There are exactly two application RPC calls, both in [add-water](../app/api/nutrition/add-water/route.ts). Both pass `p_log_id`, `p_ounces`, and `p_submission_id`, matching the intended signature `public.add_daily_water(uuid,numeric,uuid)`. There is no existing production overload or EXECUTE ACL to repair. The October 9 coordinated-dashboard migration was not applied. Missing objects, rather than an argument-name mismatch, explain the verified failure. Reloading the cache alone cannot create them.

The public schema exists and both Data API roles have schema USAGE. Catalog inspection found no authenticator schema override. The reported error shows PostgREST attempting public RPC resolution. A read-only OpenAPI request using the publishable key was denied with “Secret API key required”; authenticated HTTP exposure and cache discovery must still be checked after approval. [Supabase's error reference](https://supabase.com/docs/guides/api/rest/postgrest-error-codes) distinguishes missing/stale functions (PGRST202), unexposed schemas (PGRST106), and permission failures (42501).

The failed missing-function call cannot increment water because the function never runs. Initial-log creation can leave a zero-intake row, with the existing unique `(client_id,log_date)` key preventing duplicate daily rows. No designated account or existing hydration entries were inspected; historical duplicate-entry absence is not claimed.

Additional exact failures: missing workout/commitment/manual-set/calendar/profile/cycle/body/intelligence dependencies; timestamp comparisons against DATE workout history; `phase` queried instead of `cycle_phase`; meal-only nutrition views omitting EMBER macro progress; authenticated audit/legal helpers using tables without client privileges; permissive policies bypassing relational ownership; sensitive entitlement fields writable by members; and non-CRUD API grants unaffected by RLS. The [34-action compatibility matrix](p0-daily-action-source-audit-2026-10-13.md) identifies endpoints, RPCs, dependencies, production status and repairs. The [exact catalog fixture](p0-daily-action-production-fixture-metadata-2026-10-13.json) contains schema metadata only.

## Exact proposed migration order

The [manifest](p0-database-repair-migration-manifest-2026-10-14.json) records full SHA-256 hashes. Apply only these reviewed files, in this order, after explicit approval and a fresh production diff. Do not use blind `supabase db push`: older local migration versions differ from applied production history.

1. [Hydration integrity](../supabase/migrations/20261013195246_p0_hydration_submission_integrity.sql): additive receipt array; owned, SECURITY INVOKER, row-locked water RPC; authenticated EXECUTE only; schema reload notification.
2. [Daily foundation](../supabase/migrations/20261014012428_p0_daily_save_foundation.sql): profiles/history, commitments, workout feedback/sessions/sets, NULL-safe atomic replacement RPCs, civil DATE preservation plus new actual session timestamp, history-preserving workout RPC, owner/parent/tier guards, assessment-window access, protected entitlements, bounded API grants, and server-only audit/legal permissions.
3. [Calendar dependencies](../supabase/migrations/20261014023155_p0_connected_calendar_dependencies.sql): seven tables, owner reads, server writes, private credentials/OAuth/write receipts, service-only leases/disconnect RPCs.
4. [Guidance/progress metadata](../supabase/migrations/20261014023157_p0_daily_guidance_progress_metadata.sql): cycle answers/ovulation/burden, body assessments, provenance, nutrient/supplement dependencies, restrictive relational guards, insert-missing reference seeds. Nutrient-interaction seeds explicitly prevent duplicates on replay.

These files retain existing records and named policies, add restrictive checks, and perform no customer backfill, destructive column conversion, or historical timestamp invention. Reference/configuration inserts in migration 4 are part of the reviewable proposal. Restrictive write/delete checks prevent foreign-client mutation while preserving authorized legacy reads. Audit append uses a verified server operation; clients receive no direct audit access.

## Matching application changes

Both water controls persist the same submission UUID, amount, and member-local date before sending. Failed or ambiguous responses and PWA reloads retain the pending tuple. The route requires a valid caller identifier and local date; concurrent first-log conflicts re-read the one owned daily row. The status dock uses the saved total returned by the RPC.

Nutrition combines confirmed meals and EMBER macro entries exactly once, including daily blocks and What's Next. The cycle column is corrected, read failures are marked degraded without manufacturing completion, and macro entry remains EMBER-only. Meal/barcode/photo restrictions remain enforced.

Workout readers use actual timestamps for new sessions and civil dates for legacy sessions, including local midnight and DST. Legacy rows do not acquire fabricated timestamps. Audit, consent, and legal acceptance operations verify request identity and client ownership before privileged transport.

## Completed local checks

- Full web suite: **501 passed, 0 failed, 0 skipped**.
- TypeScript: passed.
- Lint: passed with existing warnings.
- Production build: passed using explicitly fake local service configuration.
- Exact P0 SQL files: applied twice to a disposable reconstruction of **56 production base tables, 2 functions and 3 real views**, including constraints, policies, indexes, ACLs and default ACLs. Synthetic member fields and DATE history remained unchanged; reference seed counts stayed stable.
- Hydration: synthetic 36 + 8 -> 44 oz; same identifier -> 44; new session reload -> 44. Route/UI tests include lost response after commit, concurrent first-log submissions, invalid amounts, storage failure, owner denial and local-day rollover.
- Other daily saves/readback: check-in, sleep, recovery, cycle, meals/macros, measurements/body records, profile history, commitments/internal schedule, workout feedback, workout resume/completion/manual sets, daily status and recommendation history.
- Security negatives: cross-user/client/parent writes, foreign deletes, malformed legacy parent mutation, anonymous RPCs, protected entitlement updates, EMBER meal denial/macro allowance, private calendar reads/writes, unauthorized catalog writes, forged audit/consent identities. NULL/invalid set and commitment replacements preserve existing saved records.
- Calendar: synthetic service save/member readback, foreign isolation, lease ownership, credential/OAuth/write-operation privacy.
- Workout DATE regressions: Chicago midnight, timestamp precedence, stable legacy retry, new same-day plan history, and no legacy timestamp backfill.

The [independent review](daily-database-repair-independent-review-2026-10-13.md) records these checks and fixture limits. These checks are local, not a live HTTP or installed-PWA certification.

## Outstanding failures and release gate

Production still lacks the audited objects. The live browser dashboard redirects to login; no test account was designated. Production migration execution and application deployment await the user's explicit approval.

An ambiguous water attempt from a previous local day is retained and blocks a new drink until its original saved state is reviewed. Automatic prior-day receipt reconciliation is not implemented. This prevents accidental duplication but requires a recovery path before claiming complete resilience.

Several existing actions remain multi-statement saves: daily check-in, manual workout/set saves, cycle flow/provenance/trends and measurements/body assessments. Errors after an early write can leave partial records; cycle-flow append paths lack submission IDs. Local happy-path readback does not certify uncertain-response or concurrent retries for these actions.

Google calendar OAuth variables, calendar credential encryption configuration and CRON_SECRET were absent from the inspected Vercel variable inventory. Provider connection/synchronization requires configuration and authorized provider tests; database tables alone do not activate it. PHOENIX photo meal estimation remains an explicit 501/unavailable implementation. Optional wearable resting-energy CHECK widening remains a separate review artifact. Ancillary posture/recipe/onboarding/commerce dependencies and broader non-daily grants are documented in the earlier schema review and are outside these four migrations.

After approval: recheck target/catalog and restoration capability; verify the manifest; apply only the four files in order; confirm all function names/parameters, RLS, privileges and schema-cache visibility; stage the matching application build and deploy it; then use the designated accounts to run every essential matrix action through the live browser and installed PWA.

For each live test, record the account/tier and prior state, save a uniquely identified test action, confirm the new value, refresh and reopen the PWA, confirm persistence, retry the same identifier where supported, and verify record count/value unchanged. Verify What's Next and streak/progress changes after actual recorded actions. Run allowed EMBER saves and denied feature/direct-Data-API/tier-change checks. A save success toast, HTTP 200, READY deployment, or local test pass does not satisfy this gate by itself. Any failure stays listed and prevents an operational declaration.
