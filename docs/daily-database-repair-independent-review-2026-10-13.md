# Independent daily database repair review — 2026-10-13

This review inspected existing version-controlled SQL and ran disposable local databases only. No production schema, customer records, audit records, or provider state was changed. Fresh production inventory is owned by the incident lead; the older saved fixture is not evidence of current production state.

## Existing repair and rehearsal results

`docs/sql/production-schema-repair-2026-10-13.sql` contains 4,067 lines and is an approval artifact, not a recorded Supabase migration. It includes broad profile, body-assessment, physiology, supplement, billing, calendar, and reference-seed changes beyond a daily-functionality repair. Do not execute it merely because its local rehearsal passes.

The following commands passed on 2026-10-13:

- `node scripts/verify-production-schema-repair.mjs`: preserved synthetic member fields and legacy workout history; no profile/snapshot customer backfill; water UUID retry deduplication; commitments invalid-input rollback; ownership and anonymous denials covered by the existing assertions; direct new-profile/schedule/workout-parent boundaries; service-only commerce readiness.
- A disposable derivative repeated the entire bundle twice before running those same assertions. Both applications and the assertions passed. This establishes replay viability against that synthetic fixture, not reconciliation with an arbitrary existing schema.

The verifier reads 21 production-metadata base tables. It does not restore the saved `grants` field; it manually grants a subset of base privileges. It does not represent current default privileges, function definitions/ACLs, real JWT claims, production cardinalities, actual view definitions, actual storage behavior, or provider integrations. Its fixture omits the existing daily tables for sleep, recovery activities, streaks, dashboard recommendations, PHOENIX completions, and internal calendar events. Therefore its pass is not a save/reload validation of all daily actions.

## Reproduced gaps in the existing broad repair

The following were reproduced with synthetic records after executing the full existing review bundle. They were never attempted against production.

| Case | Observed result | Required correction in a new repair |
| --- | --- | --- |
| `replace_daily_commitments('LOCAL-QA-ONLY', SQL NULL)` with one saved block | The call succeeded and block count changed from one to zero. | Reject SQL NULL with `jsonb_typeof(p_blocks) IS DISTINCT FROM 'array'` before DELETE; then validate array length separately. The narrower outage SQL already has this safer validation; the broad bundle would replace it with the old form. |
| `replace_workout_sets(owned_session, SQL NULL)` with one confirmed set | The call succeeded and set count changed from one to zero. | Use the same explicit NULL/type rejection before DELETE. Preserve intentionally valid empty-array behavior separately. |
| Insert a nutrition row with caller's `auth_user_id` but another synthetic member's `client_id` | INSERT succeeded because an older permissive owner-UUID-only policy combines with the stricter policy using OR. | Add a restrictive boundary binding the referenced `client_id` to the same authenticated user, or replace applicable policies only after reviewing all definitions. Do not assume another permissive policy tightens access. |
| Call `add_daily_water` on that mismatched nutrition row | The RPC succeeded and added 8 oz to a row carrying the other client's ID. | Validate the referenced owned client in the RPC and preserve the equivalent direct-table ownership boundary. Review the same relationship in recovery, cycle, workouts, check-in, streak, feedback, and progress tables. |

The current broad repair's restrictive relational guards cover many new feature tables but do not close this core nutrition relationship. The original daily migration's NULL checks and the earlier workout-saving function should not be copied wholesale into a new repair.

## Minimal coordinated repair strategy

1. Inventory current production relations, exact column types/defaults/nullability, unique conflict keys, policies, table/column grants, schema exposure, exact RPC argument names/types, default function ACLs, existing triggers, and migration history. Read-only catalog inspection should remain separate from customer-data inspection.
2. Add the missing hydration UUID column and owner-checked `add_daily_water(uuid,numeric,uuid)` using the application's exact parameter names. Keep `SECURITY INVOKER`; serialize on the owned daily log with `FOR UPDATE`; append the submission identifier and increment water in the same transaction; return existing state on replay. Explicitly revoke PUBLIC/anon EXECUTE and grant authenticated EXECUTE. Rehearse under the current production default ACLs.
3. Add missing cycle metadata and workout source/planned-exercise columns. Create exercise sessions and sets before their replacement RPC. Bind each session to its owned workout and client; bind each set to that session's workout and exercise.
4. Create the current history-preserving `save_daily_workout` implementation from the October 12 source. Enforce owned-client program agreement, valid local-day bounds, valid exercise arrays, and appropriate member entitlement protection. Retain prior sessions when exercise identities differ. Do not copy the earlier overwrite-prone implementation.
5. Reconcile recurring commitments with the current production definition. Preserve any stronger already-deployed ownership policy and NULL rejection; avoid duplicate indexes or weaker replacement functions.
6. Add only daily-action relations/columns/grants proven missing. Verify existing sleep/recovery/derived streak/calendar operations with their actual grants and conflict keys, rather than treating the broad bundle as coverage.
7. Keep audit logging append-only through an authorized server operation after verifying the authenticated user and request. The audit helper needs INSERT only; authenticated clients retain no audit table access. Preserve existing immutable triggers, RLS, and denial of unrelated SELECT/UPDATE/DELETE or anonymous access. A service INSERT grant must accompany the validated server path, rather than merely suppressing optional append failures.
8. Keep connected-provider calendar schema/configuration and unrelated catalog seeds separate where they are not essential to the approved repair. External calendars require all seven tables, service-only credential/OAuth/write records, ownership-checked server routes, leases, and configured provider/encryption/cron prerequisites; table creation alone is insufficient.
9. Use new CLI-generated migration files; do not rewrite applied source migrations or falsely mark history. Each migration should either be safe to replay against the expected verified schema or fail clearly on incompatible existing definitions. `IF NOT EXISTS` alone does not verify existing column types, defaults, constraints, policies, indexes, or grants.
10. Rehearse the exact new files twice with synthetic owner, other-user, anonymous, EMBER, and privileged-server cases. Require successful save/readback, rejected-write atomicity, preserved history, retry deduplication, and security-boundary checks before asking for production approval. Live browser and installed-PWA save/reload checks remain required after authorized release.

## Function and privilege review

The current broad bundle's listed functions use invoker rights, explicit search paths, and revocations of PUBLIC/anon access. Its service-only calendar/commerce functions also revoke authenticated EXECUTE. That is preferable to changing functions to SECURITY DEFINER. A fresh production inspection must still check other overloads and retained ACLs; `CREATE OR REPLACE FUNCTION` preserves an existing function's ACL, while new functions can receive privileges through project-specific default ACLs.

Creating a named policy only when its name is absent does not reconcile a conflicting existing policy definition. Likewise `CREATE INDEX IF NOT EXISTS` only tests the name, and an equivalent production unique constraint can lead to an unnecessary second index. The repair must verify exact expected definitions before replacing or adding objects. Keep all existing records; do not remove duplicates or backfill client profiles implicitly.

No production or authenticated PWA result is claimed by this independent review. Release remains contingent on the fresh compatibility matrix, exact reviewed migration files, explicit production approval, and authorized live save/reload validation.

## New daily foundation and exact catalog fixture

The new CLI-generated `20261014012428_p0_daily_save_foundation.sql` creates the missing daily profile/history, commitment, workout feedback, and manual-set dependencies; uses NULL-safe replacement RPCs; adds restrictive client/parent ownership and program consistency; protects member entitlement fields; and enables owner-scoped assessment-window saves. Audit/consent writes remain server-only. It does not include onboarding backfills, billing provisioning, reference seeds, or unrelated advanced feature schemas.

Production `workout_logs.workout_date` is DATE. The repair retains it and adds nullable `workout_started_at`; existing rows receive no invented times. The new save RPC accepts the timestamp plus `workout_local_date`, checks owned program and timezone/day bounds, uses true timestamp bounds for new rows and local-date fallback for old rows, and retains prior sessions when exercise identities change.

The complete fresh catalog export reconstructs 56 public base tables, two actual functions, three actual views, constraints, indexes, RLS modes, policies, triggers, explicit table/column/function privileges, and production default ACLs in `scripts/lib/p0-production-fixture.mjs`. Authentication helpers remain synthetic and no user rows are exported. Production ACLs also contain broad non-CRUD grants; the daily foundation removes TRUNCATE/REFERENCES/TRIGGER/MAINTAIN from Data API roles on its daily dependencies, and newly created tables explicitly revoke default broad access before bounded grants. Broader public-schema non-CRUD grants remain an independent review finding.

`scripts/verify-p0-daily-repairs.mjs` applies the exact new P0 files twice and validates hydration replay, daily writes and readback under reset request identity, real nutrition views, retained workout dates/history, atomic replacement failures, parent consistency, anonymous/cross-user denial, EMBER macros versus meals, protected entitlement fields, and service-only audit append. The incident lead's final report must state the actual finalized run result; a preview run using temporary substitutions for incomplete files does not establish that result.

After all four new files were populated, the exact verifier passed without substitutions. Additional assertions passed for calendar server writes and member readback, private calendar table isolation, wrong-user leases, body/session and menstrual-flow parent relationships, reference-catalog reload, and unchanged seed counts after replay. The interaction seed required an explicit natural-key `NOT EXISTS` check because its generated UUID primary key alone could not prevent duplicate reference rows.

`node --test tests/workoutDateCompatibility.test.mjs` passed all three cases. Its timestamp assertion compares instants rather than timezone-dependent PostgreSQL JSON strings. The exact verifier additionally confirms Los Angeles late-night civil dates and Chicago's 25-hour DST day.

An independent second reviewer applied the foundation twice under both `postgres` and a simulated administrator `supabase_admin`. Daily RPC execution is authenticated-only under both sets of default ACLs; the entitlement trigger function is unavailable to API roles. New set writes and replacement calls reject a synthetic malformed foreign-client parent. Separate restrictive DELETE policies retain legacy read visibility while denying deletions of those inconsistent sets, PHOENIX completions, and schedule events. No production records were inspected or mutated to reproduce these cases.

These results still do not cover real role memberships/schema ACLs, concurrent database connections, PostgREST/schema-cache behavior, authorized HTTP saves, browser refresh, installed PWA, or provider APIs. Service-only legal/consent access also requires the matching application changes before release. Named `IF NOT EXISTS` policy/index/column checks preserve objects on replay but do not independently reconcile later drift; fresh preflight definitions remain required before production approval/execution.
