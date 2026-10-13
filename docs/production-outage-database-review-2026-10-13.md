# ANASTASIS outage database review — October 13, 2026

No production database changes were made. The code mitigation can restore page availability independently; it cannot activate database operations whose tables, columns or RPCs are absent.

The incident lead freshly confirmed Vercel production uses `lcccpqgnpznhbtmkmytp.supabase.co`. Catalog evidence for that project confirms 14 migration-history entries through October 8, unchanged from the preceding audit. `client_schedule_blocks` is absent from `public`, so the schema-cache error is caused by missing schema, not a table-name typo. Its definition is in `20260708_launch_readiness_profiles_payments_rls.sql`; that broad file also includes unrelated policy changes and customer backfills and must not be replayed as this repair.

`recommendation_audit_logs` exists with RLS enabled and self-user SELECT/INSERT policies. Neither `authenticated`, `anon` nor `service_role` has SELECT/INSERT table privileges. Table privileges are checked before RLS; the existing owner policy does not by itself permit INSERT. The legal-foundation source omitted explicit grants. The application helper only appends an audit record; it does not require SELECT, UPDATE or DELETE. Its failures must remain independent of dashboard rendering.

The initialization dependency is `ProgramPage` → daily plan and program logic → audit append → `getDailyScheduleState` → `client_schedule_blocks`. The schedule loader threw the missing-table error and propagated it to the whole-page error boundary. Several other optional inputs also depend on absent schema. The compatibility catalog query at `docs/sql/production-dashboard-compatibility-2026-10-13.sql` inventories page inputs, required columns, RPCs, grants, policies and relevant triggers without reading customer rows.

## Exact approval artifacts

These are review SQL files, not migration-history entries, and have not been executed in production. The installed Supabase CLI could not read help inside the sandbox because its telemetry write targets `~/.supabase`; the approval prompt was aborted. No invented migration filename was added. After approval, record the approved statements through the established migration mechanism, then recheck catalog definitions and advisors.

1. `docs/sql/production-outage-schedule-review-2026-10-13.sql` creates only the missing recurring-commitments table, indexes, authenticated CRUD protected by RLS, and `replace_daily_commitments(text,jsonb)`. The owner policy verifies both `user_id` and the referenced client's `auth_user_id`. The RPC is SECURITY INVOKER, locks the owned client and replaces blocks in one transaction; a failed insert restores previous blocks. It grants no anonymous table access and no anonymous/public RPC execution. Preconditions abort if the table or function has appeared since review.
2. `docs/sql/production-outage-audit-review-2026-10-13.sql` grants only INSERT on the existing audit table to `authenticated`. It first requires enabled RLS and verifies that every applicable permissive INSERT policy is the existing self-user predicate. It changes no policies and grants no SELECT/UPDATE/DELETE, anonymous or service-role access.

Both transactions use a five-second lock timeout and thirty-second statement timeout and request PostgREST schema reload on commit. They contain no customer backfill, existing-row UPDATE/DELETE, RLS disablement, SECURITY DEFINER function, or all-feature schema rollout.

Risks requiring explicit production approval: table/function creation and an authenticated audit INSERT permission change; brief DDL/catalog locks; the table foreign keys apply cascading cleanup if its auth user/client is later deleted; future authorized schedule replacement deletes that user's prior commitments atomically before inserting replacements. Existing customer/activity records are untouched by applying either artifact. Failure aborts its transaction. Do not rollback by dropping a populated table; prefer a reviewed corrective migration.

## Remaining database blockers outside these narrow repairs

| Capability | Missing production prerequisite | Consequence |
| --- | --- | --- |
| Hydration add | `nutrition_logs.water_submission_ids`, `add_daily_water(uuid,numeric,uuid)` | Add-water cannot complete its atomic deduplicated save. Existing intake history remains readable. |
| Workout save/resume | `workout_logs.workout_source`, `planned_exercises`, `save_daily_workout(text,timestamptz,timestamptz,jsonb)` | New daily workout saves fail. A later repair must use the history-preserving October 12 function, not the earlier function that can overwrite changed same-day exercise identities. |
| Manual exercise sets | `workout_exercise_sessions`, `workout_exercise_sets`, `replace_workout_sets(uuid,jsonb)` | Set logging fails. Any later table policies must bind sessions to owned workouts/clients and sets to their actual owned parent, not just an editable user ID. |
| Cycle partial answer metadata | `cycle_logs.answered_fields` | Cycle logger submissions that include that field fail. The daily-check-in route's recovery save does not use this field; it must be validated separately before claiming check-in failure from this missing column alone. |
| Effective profile | `client_current_profiles` | Profile overlay is unavailable; existing client/onboarding fields supply the baseline. Profile writes that require the absent table remain unavailable. |
| Connected calendar | `calendar_events` and other connected-calendar tables/functions | External calendar import/setup remains unavailable. Saved internal `anastasis_schedule_events` are independent. |
| Optional health provenance | `health_provenance_records` | New provenance functionality is unavailable; does not justify blocking the page. |

The already-existing broad 4,067-line schema repair bundle remains outside this P0 proposal. It is not required to restore dashboard rendering and requires its own review.

## Validation and release boundary

Run `node scripts/verify-production-outage-repairs.mjs` to execute the exact two review artifacts against synthetic PGlite fixtures. It exercises schedule save/readback, invalid replacement rollback, direct cross-client INSERT/UPDATE rejection, cross-user isolation, anonymous denial, audit owner INSERT, denial of audit SELECT/UPDATE/DELETE and preservation of synthetic client history. This rehearsal does not prove production provider behavior, live cardinality or authenticated customer journeys.

Before production execution, obtain approval for the named exact artifacts and their risks, confirm current catalog preconditions, and confirm restore capability. After approved execution, verify required objects/grants, advisors and isolated authenticated owner/other-user behavior through the application. A Vercel build or unauthenticated redirect is not proof that the live dashboard loads or daily writes persist.
