# Anastasis production migration readiness — October 13, 2026

Production application code and production database schema are out of synchronization. Deploying the consolidated code alone cannot activate all completed features. This report records a read-only audit and disposable local rehearsal; **no production migration, customer-record read, customer-record write, provider action, or secret disclosure occurred**.

## Audited target and evidence

- Supabase project: `lcccpqgnpznhbtmkmytp`, named `anastasis-elite's Project`, `ACTIVE_HEALTHY`, Postgres 17.6.1.155, `us-east-1`.
- The deployment agent verified that Vercel production's public Supabase URL points to `lcccpqgnpznhbtmkmytp.supabase.co`; this is the production database.
- Metadata queried: migration names/versions, public table and column definitions, indexes, RLS policies, grants, function presence, client triggers, and security advisors. Application/customer tables were not queried for records or counts.
- Local repository contains 43 migration files. Production reports 14 migration-history entries. Thirteen local files correlate by name with those history entries; one security-hardening file corresponds to two recorded operations. Other historical features have schema present without a matching history entry. **A filename difference is not proof that a migration is pending, and a matching name is not a source-content checksum verification.**

## Recorded migrations and timestamp drift

Use this mapping when reconciling history. Do not replay the local files solely because their versions differ, and do not rewrite applied history automatically.

| Local source | Recorded production version/name |
| --- | --- |
| `20260817_adaptive_schedule_events.sql` | `20260817162212` / `adaptive_schedule_events` |
| `20260817_tighten_schedule_event_grants.sql` | `20260817162238` / `tighten_schedule_event_grants` |
| `20260817_cross_platform_health_layer.sql` | `20260817171646` / `cross_platform_health_layer` |
| `20260817_tighten_health_grants.sql` | `20260817171754` / `tighten_health_grants` |
| `20260914192341_add_recovery_log_soreness_regions.sql` | Same version/name |
| `20260914192717_repair_recovery_logs_rls_and_conflict_key.sql` | Same version/name |
| `20260914193402_enable_cycle_logs_rls_for_checkins.sql` | Same version/name |
| `20260923_security_hardening.sql` | `20260924005820` / `security_hardening_20260923`; separate follow-up `20260924222011` / `security_hardening_owner_policies_20260923` |
| `20260820_tier_capability_macro_entries.sql` | `20261008210314` / `tier_capability_macro_entries` |
| `20260917_tier_specific_nutrition_logging.sql` | `20261008210319` / `tier_specific_nutrition_logging` |
| `20260925_nutrition_logging_integrity.sql` | `20261008221805` / `nutrition_logging_integrity` |
| `20260925_nutrition_catalog_select_rls.sql` | `20261008221809` / `nutrition_catalog_select_rls` |
| `20261008_meal_logging_boundaries.sql` | `20261008222108` / `meal_logging_boundaries` |

The latest recorded migration is October 8, 2026. The daily dashboard, connected calendar, program ownership/history, and secure commerce migrations from October 9–12 are not recorded; their defining functions/tables are also absent where described below.

## Other local migrations: observed state

The following table accounts for the other 30 local files. “Present” describes observed objects, not proof that every statement in the source ran. Missing objects mean the corresponding completed feature cannot be considered fully enabled.

| Local source | Production evidence / next review |
| --- | --- |
| `20260701_legal_compliance_foundation.sql` | `legal_acceptances`, `feature_consent_events`, `recommendation_audit_logs` present; reconcile policies/triggers rather than replaying blindly. |
| `20260702_aos_dashboard_logic_engine.sql` | `dashboard_daily_recommendations` present. |
| `20260702_daily_check_in_and_recovery.sql` | `recovery_activity_logs` and relevant recovery columns present. |
| `20260702_internal_tiktok_social_intelligence.sql` | Four social tables present; service-only use is consistent with their no-client-policy advisor notices. |
| `20260702_phoenix_daily_task_completions.sql` | `phoenix_daily_task_completions` present. |
| `20260703_sleep_logs_and_daily_streaks.sql` | `sleep_logs`, `daily_execution_status` present. |
| `20260703_workout_os_exercise_metadata.sql` | `exercise_metadata` absent. |
| `20260703_workout_plan_feedback.sql` | `workout_plan_feedback` absent. |
| `20260708_dashboard_checkin_conflict_keys.sql` | Nutrition unique key present under a different name; recovery key present. Cycle has two equivalent `UNIQUE (client_id, log_date)` constraints (`cycle_logs_client_id_log_date_unique`, `cycle_logs_unique_daily`); avoid adding another or removing either without review. |
| `20260708_launch_readiness_profiles_payments_rls.sql` | All seven new tables absent: onboarding snapshots, current profiles, profile history, schedule blocks, invitations, webhook events, rate-limit events. Several policies on existing tables already present. Raw replay fails on duplicate policy. Contains customer snapshot/profile backfills requiring separate review and approval. |
| `20260728_workout_os_adaptive_foundation.sql` | Recovery soreness regions present; prerequisite `exercise_metadata` absent. |
| `20260820_posture_photo_landmarks.sql` | `assessment_photos` present with analysis fields; `posture_photo_landmarks` absent. Storage bucket/policy operations need separate inspection; raw replay is not assumed safe. |
| `20260824_recipe_infrastructure.sql` | `recipes`, `client_recipe_favorites` absent. Contains reference recipe seed inserts. |
| `20260825_nutrition_target_engine.sql` | Existing health tables present; current metric-type checks omit `resting_energy`. Replacement requires exact constraint inspection and rehearsal. |
| `20260827_accountability_partner_engine.sql` | Cannot apply until missing `client_current_profiles` is created. |
| `20260828_suggested_food_micronutrients.sql` | `foods` lacks `allergens` and the nullable micronutrient columns from this file. Normalized `food_nutrients` exists; verify application fallback behavior and catalog completeness. |
| `20260909_body_assessment_architecture.sql` | All three body-assessment tables absent. |
| `20260912_body_assessment_mass_conserving_results.sql` | Composition-results table and preceding architecture absent. |
| `20260914_menstrual_burden_physiology_patterns.sql` | All twelve physiology/menstrual tables absent. Existing cycle columns alone do not activate this layer. |
| `20260914_provenance_audit_privacy_hardening.sql` | Missing physiology prerequisite tables. |
| `20260915_manual_workout_source_and_planned_exercises.sql` | `workout_logs.workout_source` and `planned_exercises` absent. |
| `20260917_health_provenance_records.sql` | `health_provenance_records` absent. |
| `20260918_manual_workout_exercise_sessions_and_sets.sql` | Both exercise-session and set tables absent. Required before daily-dashboard migration. |
| `20260919_nutrition_food_schema_alignment.sql` | Canonical `foods.brand` and ownership/source/barcode columns present. Source includes a conditional `brand_name` update/drop: do not replay unreviewed or erase data. |
| `20260925_micronutrient_intelligence_layer.sql` | All sixteen nutrient/supplement intelligence tables absent. Includes reference seed data. |
| `20260925_supplement_recommendation_engine_v1.sql` | Three engine tables absent; depends on missing micronutrient `supplements` table. Includes a supplement reference update. |
| `20261009004035_coordinated_daily_dashboard.sql` | `cycle_logs.answered_fields`, `nutrition_logs.water_submission_ids`, and all four RPCs absent. Missing schedule/workout prerequisites make raw replay invalid. |
| `20261011210620_connected_calendars.sql` | All seven calendar tables absent; calendar functions consequently absent. |
| `20261012173013_member_program_ownership_and_workout_history.sql` | `program_outputs` already exists, but new ownership policies and `save_daily_workout` replacement are pending. Apply after daily-dashboard prerequisites. |
| `20261012174637_secure_checkout_fulfillment_and_billing.sql` | Purchase/event tables and all fulfillment/claim/subscription/readiness/protection functions absent. Missing invitations base table is a prerequisite. |

## Authentication, permissions, and feature consequences

Application identity checks use server-verified `supabase.auth.getUser()`. Middleware refreshes cookies, rejects unauthenticated protected APIs, verifies member access from the owned `clients` row, and redirects incomplete profiles into onboarding. Cookie changes are retained on redirects/errors. Authentication uses cookie-based `@supabase/ssr`, and privileged clients use server-only environment keys. The use of server-confirmed `getUser()` is supported by [Supabase's authentication reference](https://supabase.com/docs/reference/javascript/auth-getuser).

Tier rules are centralized in `lib/entitlements.ts` and exercised by entitlement/handler tests: EMBER macro entry/basic recovery, IGNITE meal/barcode logging and recommended recovery, PHOENIX recommended meals and directed recovery. All tiers have calendar, What’s Next, workouts, assessments and progress access. Application tier checks obtain program from the owned client row, rather than user-editable metadata. Database meal-tier boundaries are already present.

**Production entitlement protection is incomplete:** `clients` has owner-scoped UPDATE RLS, but authenticated users have UPDATE privileges for `program`, `access`, `active`, `verified_purchase`, `subscription_status`, and `subscription_ends_at`. No client protection trigger exists. This metadata establishes that the database currently permits an owner to alter authorization fields; no attempted exploit or customer update was performed. The pending secure-commerce migration adds a protective trigger that rejects such changes.

`client_billing` currently has RLS disabled; however, both `anon` and `authenticated` lack SELECT/INSERT/UPDATE/DELETE table privileges. The audit therefore does **not** establish a current public billing disclosure. The launch prerequisite enables RLS and owner reads; commerce hardening keeps writes server-only. Preserve both properties together.

**Pending policies also need correction before activation.** In disposable fixtures, the launch current-profile and direct schedule policies accepted the caller's own `user_id` paired with another member's `client_id`. The pending manual exercise-session policy accepted the caller's own `auth_user_id` paired with another member's workout ID. An ownership field must be bound to the referenced owned client/workout, rather than checked in isolation. These reproductions used synthetic data only. The launch profile-history INSERT policy also lacks the corresponding authenticated INSERT table grant, causing a permission error. Verify the intended history-writing route and strengthen relational ownership before adding that grant.

Missing tables affect invitation validation/rate limiting, onboarding snapshots/current profiles, daily structure, manual sets, hydration retries and workout saves. New checkout explicitly tests `commerce_configuration_ready()` and fails closed if missing. Releasing code without its database prerequisites will leave these capabilities unavailable.

PHOENIX photo macro estimation is an incomplete implementation: `app/api/nutrition/photo-estimate/route.ts` GET returns `available:false`; valid PHOENIX POST returns `501` and `configured:false`. The UI offers manual/barcode fallback. A production deployment does not turn this stub into an estimator.

Security advisors reported leaked-password protection disabled and four social tables with RLS but no client policies. The latter can be intentional for service-only internal data; no permissive policies should be added merely to remove the notices. Advisor links: [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Environment prerequisites

The deployment agent inspected environment **names/configuration presence**, not secret values. Calendar OAuth/encryption/cron configuration and `STRIPE_WEBHOOK_SECRET` are absent from production. Confirm the complete target-specific configuration before feature activation.

| Capability | Required configuration / verification |
| --- | --- |
| Auth and database | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`; production Supabase URL confirmed. |
| Secure commerce | Live `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, correct six tier/billing price variables, verified webhook destination and event types, verified `access_months` metadata for one-time prices. Never perform real checkout or charge during smoke tests. |
| Invitations | `RESEND_API_KEY` and verified `onboarding@anastasiselite.com` sender; readiness must include base invitations/rate-limit tables. Do not send test messages to customers. |
| Application origin | `NEXT_PUBLIC_APP_URL` matching the production origin and consistent auth redirect allowlist. |
| Google calendar | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, exact registered `GOOGLE_CALENDAR_REDIRECT_URI`, and `CALENDAR_CREDENTIAL_ENCRYPTION_KEY`. |
| iCloud calendar | Calendar encryption key and user-provided provider credentials through the authorized application flow; never gather these in logs or documentation. |
| Calendar cron | `CRON_SECRET`; Vercel config schedules `/api/calendars/cron` once daily at `06:00 UTC`. Existing per-connection 15-minute `next_sync_at` values do not make a daily cron run every 15 minutes. |

`CALENDAR_CREDENTIAL_ENCRYPTION_KEY` must decode to 32 bytes and be securely retained; changing it breaks existing encrypted credentials. No generated replacement or production setting change occurred in this audit.

## Exact dependency order for a reviewed repair

This is a preparation/review order, **not authorization to execute database writes**. Do not run a blind `db push` against this history. Create CLI-generated, new repair migrations from a verified production schema diff, retaining existing policies and records. Do not use migration-history repair to pretend absent DDL has been applied.

1. Confirm restore capability and save a schema-only inventory. Compare actual policies, grants, indexes, constraints, functions, storage configuration and migration statement checksums with the source. Obtain explicit approval for any customer backfill, destructive schema operation or irreversible migration. Keep customer data and secrets out of the report.
2. Prepare launch foundation from `20260708_launch_readiness_profiles_payments_rls.sql`: create the seven missing tables and their grants/RLS, enable RLS on existing launch tables, retain already-present policies with verified definitions, and add only missing policies/indexes. Strengthen profile/snapshot/history/schedule policies to verify the referenced client belongs to the same authenticated user; reconcile profile-history INSERT grants with the authorized history-writing route. **Separate its two customer INSERT backfills into a separately reviewed operation; omit those from any no-customer-write rollout.** Check duplicate billing client IDs with an authorized aggregate-only preflight before creating the unique index; never silently delete or consolidate duplicates.
3. Apply profile-column additions from `20260827_accountability_partner_engine.sql` after foundation. This is required by onboarding profile persistence.
4. For workouts, create `exercise_metadata` from `20260703_workout_os_exercise_metadata.sql`, then its additions from `20260728_workout_os_adaptive_foundation.sql`; separately create `workout_plan_feedback`. Add `workout_source`/`planned_exercises` from `20260915_manual_workout_source_and_planned_exercises.sql`, then create exercise sessions/sets from `20260918_manual_workout_exercise_sessions_and_sets.sql`. Bind session/set ownership to the referenced owned workout/client before activating direct authenticated writes; the supplied policy alone does not enforce this relationship.
5. Apply `20261009004035_coordinated_daily_dashboard.sql` only after schedule blocks, workout-source columns, and exercise sessions/sets exist. Then apply `20261012173013_member_program_ownership_and_workout_history.sql`, retaining legacy `program_outputs` data while adding restrictive ownership and the history-preserving workout function.
6. Apply secure commerce from `20261012174637_secure_checkout_fulfillment_and_billing.sql` after invitations and billing foundation. Verify RLS/server-only writes and the client entitlement trigger together. Keep checkout unavailable until this is complete and webhook delivery is verified; a readiness RPC alone does not prove the environment/provider configuration works.
7. Apply connected calendar `20261011210620_connected_calendars.sql` after basic auth, with all seven tables, leases, service-only credential/OAuth/write records and ownership policies. Configure the registered OAuth redirect, encryption key and cron secret only through secure configuration tools. Verify an isolated account before customer connection/write operations.
8. Independently review the missing historical feature branches in dependency order: posture additions/storage configuration; recipe schema/reference seeds; body architecture then composition results; menstrual architecture then privacy hardening; health provenance; micronutrient intelligence then supplement engine. Review health check replacements and canonical food alignment against actual constraints/columns. Preserve normalized nutrition ownership/tier policies already deployed. No column drop, catalog update or reference seed is assumed automatically approved.
9. Rehearse the exact finalized repair SQL against an isolated schema copy with synthetic fixtures and current production policies, then run advisors and ownership/tier/readback tests. Obtain required approval for the concrete reviewed operations before production execution. After application, confirm recorded versions, required columns/tables/functions, grants and advisors through metadata.
10. Deploy the same validated code commit, confirm Vercel `READY`, domain assignment and deployed SHA, then perform public/non-destructive smoke tests. Connected save/readback tests require an explicitly authorized disposable non-production account/database. No production customer health, calendar, account or purchase mutation is part of this audit.

## Disposable local rehearsal

PGlite rehearsal used production **schema metadata only** for thirteen existing base tables: column types/defaults, primary/unique/check constraints and current policies. Foreign keys were represented for the newly created migration tables; pre-existing foreign keys and live data cardinality were not copied. Three existing views were represented by placeholders sufficient for the migration's `security_invoker` ALTER checks. Auth users and all records were synthetic `LOCAL-QA-ONLY` fixtures. This does not establish exact production migration safety or a connected end-to-end customer result.

Two expected failures were reproduced before repairs:

- Raw launch-foundation migration fails with `policy "clients read own meal entries" ... already exists`. Several policies on other existing tables also overlap.
- Raw daily-dashboard migration fails because `workout_exercise_sessions` does not exist.

The following **core dependency chain** then executed successfully in a fresh fixture, preserving the existing policies rather than recreating the duplicate launch policies:

1. Launch foundation (`20260708_launch_readiness_profiles_payments_rls.sql`), with rehearsal-only duplicate-policy handling.
2. Accountability profile columns (`20260827_accountability_partner_engine.sql`).
3. Workout source/planned exercises (`20260915_manual_workout_source_and_planned_exercises.sql`).
4. Exercise sessions/sets (`20260918_manual_workout_exercise_sessions_and_sets.sql`).
5. Daily dashboard (`20261009004035_coordinated_daily_dashboard.sql`).
6. Connected calendars (`20261011210620_connected_calendars.sql`).
7. Program ownership/workout history (`20261012173013_member_program_ownership_and_workout_history.sql`).
8. Secure commerce (`20261012174637_secure_checkout_fulfillment_and_billing.sql`).

Assertions passed for preserved synthetic client authorization fields and historical completed workouts; synthetic snapshot/profile backfill; self-tier-update denial after hardening; water retry deduplication; schedule replacement/invalid-input atomic rollback; cross-owner and anonymous denial through those RPCs; service-only commerce readiness. The backfill was tested locally only and remains outside any automatic production authorization. Direct profile/schedule/exercise-session ownership defects and the profile-history grant mismatch were separately reproduced, as described above; RPC ownership checks do not remedy direct table-policy gaps.

A second, expanded rehearsal successfully executed **23 dependency-ordered sources**: the eight core sources above plus exercise metadata, workout feedback, adaptive workout metadata, posture landmarks, recipe infrastructure, health metric checks, suggested-food micronutrients, body-assessment architecture/composition, menstrual/physiology architecture/privacy, health provenance, food schema alignment, micronutrient intelligence and the supplement engine. It used twenty-one production-metadata base tables, placeholder storage tables/folder helper and views, synthetic auth/JWT helpers, and omitted PGlite's unsupported `CREATE EXTENSION pgcrypto` statement; production metadata confirms `pgcrypto` 1.3 is already installed. Reference recipes/nutrients/supplements were seeded **only in the disposable fixture**. The same preservation/retry/rollback/access assertions passed. This establishes dependency viability under the stated adaptations, not an approved repair or full feature verification. Production duplicate cardinality, actual storage/provider configuration and customer journeys remain unverified.

Existing repository SQL tests separately cover calendar secret isolation/leases/disconnect, owned program insert/update with tier/access boundaries, and payment rollback/retry/verified-receipt ownership. The root deployment report should list the results of the current full lint/typecheck/test/build runs; historical audit results do not substitute for the new run.

## Release decision

The repository's completed code can be consolidated, committed and pushed for review. Production customer-experience readiness remains blocked by the reviewed schema repair, environment/provider setup, incomplete photo estimator, and connected isolated-account verification. Vercel `READY` would establish successful application deployment, **not** that these missing database/provider capabilities are active. The audit did not apply the repair or authorize irreversible/customer-data operations.
