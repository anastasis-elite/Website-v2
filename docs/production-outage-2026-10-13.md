# ANASTASIS dashboard outage — October 13, 2026

This release is a code-only availability mitigation. Production database repair and complete connected/device verification remain separate gates. No production migration, rollback, storage reset, service-worker unregister, or deliberate customer health-record write is included.

## Confirmed root cause

Production Vercel project `website-v2` (`prj_t7uI7hI0KMynF4hkh0iEbmyKpOUH`, team `team_9IlTosdiNM1LIWUEalcToj38`) serves commit `2eaf9f096b4f33a5fbc1b32203b00cfb4cc4c1e8` from deployment `dpl_8VC3xbo7NDPAVcn4B9SMi4bgu6eN`. Its public Supabase URL was freshly confirmed as `https://lcccpqgnpznhbtmkmytp.supabase.co`.

Read-only production catalog checks confirm `public.client_schedule_blocks` is absent. This is not merely a stale PostgREST cache or a wrong query name. Migration history still contains 14 entries ending on October 8; the prerequisite launch schema and October 9–12 dashboard/calendar/workout migrations were not activated. Earlier release-readiness documents warned about this incompatibility.

The program page, Schedule, Nutrition, Workouts and Recovery all await `getDailyScheduleState`. Its recurring-block query previously threw on a missing optional table, causing the entire page to enter its error boundary. Core identity, entitlement and onboarding checks stay mandatory. Optional profile/health/body/calendar sources and derived recommendation/execution persistence are traced in the existing dashboard readers and the outage regression suite.

`recommendation_audit_logs` exists with RLS and self-owned INSERT/SELECT policies. Fresh catalog checks show neither authenticated nor service roles have INSERT/SELECT grants. The existing helper already logged returned permission errors; rejected transport requests could still escape. The mitigation contains both failures and retains diagnostic logging. It does not grant access or change RLS.

Also confirmed missing: current profiles, connected calendar tables, workout exercise sessions/sets, health provenance, `cycle_logs.answered_fields`, `nutrition_logs.water_submission_ids`, new workout source/plan columns, and daily save RPCs. See the read-only inventory and database review artifacts. Missing save infrastructure is explicitly tested as failure, never treated as a recorded activity.

## Changed behavior and preservation

- Load each optional schedule source independently; keep available events and health state visible, with partial availability notices.
- Suppress free-time/move suggestions and reject conflict-sensitive writes and availability requests when the schedule is incomplete.
- Contain recommendation-audit and derived-state persistence transport errors.
- Read existing workout history without requiring newer optional columns; retain owner/client/date/plan restrictions and projected API output.
- Restrict service-worker caching to typed static assets and exact release URLs. Never substitute home HTML for JavaScript/CSS, cache authenticated/RSC/API responses, delete origin caches, unregister, or clear storage.
- Let updates wait for screens to close or an explicit Apply update action. Only that action triggers an update reload. Set deployment identity and uncached worker checks.

Existing data and local drafts are preserved. No schema/data fallback fabricates success or guesses missing cycle answers. Schedule changes remain unavailable until complete source data is readable.

## Validation and limits

The full web test suite, lint, production build and nonincremental TypeScript check are run for this release; exact final counts and deployed SHA belong in the release response. Tests use synthetic records and saved production schema metadata, supplemented by fresh read-only catalog checks. PGlite checks cover water retry deduplication, owned atomic commitments and workout saves, invalid-input rollback, historical preservation, and anonymous/cross-owner denial. They do not prove live write compatibility.

Local browser checks exercised EMBER/IGNITE/PHOENIX Home, What’s Next, Schedule, Nutrition, Workouts and Recovery. Simulated daily check-in and hydration saves persisted across reloads. No browser errors were observed. The temporary local QA route was removed before the production build. Fake local configuration was used for the local build; production environment values remain managed by the existing Vercel project.

Actual installed-device update/offline behavior is not established by the worker VM/lifecycle tests. Authenticated live dashboard verification requires an accessible signed-in session. A Vercel READY result or anonymous login redirect alone is not restoration evidence.

## Remaining database gate

Production water additions, new workout/session/set saves and some recovery/cycle writes still depend on missing or incompatible schema/RPCs. Time changes are intentionally blocked while schedule sources are unavailable. Audit appends remain permission denied until the reviewed minimal grant is approved. Connected calendar/provider activation remains pending separately.

The SQL files under `docs/sql/production-dashboard-*2026-10-13.sql` are review/inspection artifacts, not applied migration-history entries. No broad multi-feature schema repair is automatically authorized. Production database changes require the user's explicit approval of the exact operations and risks, followed by live catalog/readback checks.
