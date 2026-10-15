# Anastasis synchronization checkpoint — October 13, 2026

The completed application changes are consolidated on `codex/coordinated-daily-dashboard` for release review. Production activation is blocked by database/provider prerequisites. No production schema, customer record, purchase, provider calendar or email was changed.

## Repository safety and consolidation

- Repository: `anastasis-elite/Website-v2`; origin `https://github.com/anastasis-elite/Website-v2.git`.
- Fetched all remotes with pruning. Remote `main` at `d8877518edd4c9d0efe35421863e5b7ab465ffc2` is already an ancestor of the release branch; no merge conflicts exist.
- Previously unpushed `6f03da2` is retained. Guided Today and check-in/navigation work is incorporated, together with the explicitly approved About redesign.
- Older Workout OS and `App/page.tsx` branch work is already incorporated. The lone divergent dashboard-social-migrations patch is equivalent to incorporated `269f720`; no additional merge is needed.
- Draft PR #10 is the outstanding review branch. Main has neither branch protection nor repository rulesets; it is the observed production Git branch. No merge was performed because it would activate code against incompatible production schema.
- Stashes remain intact. Unfinished AOS marketing prototypes and an older conflicting nutrition overhaul are deferred. A valid Strength Assessment link fix was recovered independently; all three shortcuts now target the actual strength form.
- Onboarding resubmission now uses the owner-scoped compare-and-swap helper, preserving concurrent Today preferences and schedule overrides. A behavioral regression covers retry success and exhaustion.
- Initial refs, binary working/index patches and untracked files are backed up at `/private/tmp/anastasis-sync-20261013-103831`; `all-refs.bundle` verified successfully. Generated TypeScript cache and Supabase temporary files remain outside the application commit.

The consolidated experience includes EMBER/IGNITE/PHOENIX, daily check-in, shared daily guidance/What's Next, hydration retries, scheduling, tiered nutrition, recorded workouts, recovery, navigation, connected-calendar implementation and mobile calendar work. Existing capability boundaries and historical logs remain part of the code.

## Fresh validation

| Check | Result |
| --- | --- |
| Web and mobile lockfile installs | Passed: `npm ci --no-audit --no-fund` |
| Web tests | 456 passed; 0 failed/skipped |
| Native calendar tests | 8 passed; mocked provider/device transport |
| Web TypeScript after final build | Passed: nonincremental no-emit check |
| Mobile TypeScript | Passed |
| Web lint | Passed with existing repository warnings |
| Mobile lint | Passed; legacy-config notice |
| Web production build | Passed with explicitly fake local service configuration |
| Guided Today browser journey | 47 checkpoints passed across all tiers, mobile/desktop and narrow-screen layout; external requests blocked and saves simulated |
| About browser/visual checks | 320, 390 and 1440px passed: page render, heading, CTA destinations, no horizontal overflow/browser exceptions |
| Daily dashboard SQL fixture | Passed |
| Exact proposed schema repair | Passed using the saved production schema metadata and synthetic records; no remote database connection |
| Whitespace/fixture cleanup | Passed; temporary `/local-dashboard-qa` route removed before final production build |

Reproduce the proposed repair test with `node scripts/verify-production-schema-repair.mjs`. The test checks omitted customer backfills, preserved member fields/history, self-entitlement denial, water retry deduplication, commitment rollback, anonymous/cross-owner RPC denial, direct profile/schedule/workout-parent/history ownership, and service-only commerce readiness. Storage/views/JWT helpers are local placeholders; real production cardinality and connected provider behavior remain unverified.

## Production evidence and remaining gates

- Vercel team `team_9IlTosdiNM1LIWUEalcToj38`, project `website-v2` / `prj_t7uI7hI0KMynF4hkh0iEbmyKpOUH`, Next.js, Node 24.
- Domain `anastasiselite.com` is verified and assigned to READY production deployment `dpl_3Mc7zcaQ1yaEK4qAXVtMS6DccRpR` at commit `d8877518edd4c9d0efe35421863e5b7ab465ffc2`.
- Read-only production smoke: `/`, `/about`, `/program`, `/login` return 200 with CSP/nosniff headers; anonymous IGNITE dashboard returns 307 to login. `/api/daily-check-in` GET returns 405; `/api/calendars/connections` returns 404 on the old build. No authenticated/customer write was attempted.
- Confirmed production Supabase project `lcccpqgnpznhbtmkmytp`. Required schema/RPCs are missing and application deployment alone cannot repair them.
- Review [migration readiness](production-migration-readiness-2026-10-13.md) and the exact [schema repair bundle](sql/production-schema-repair-2026-10-13.sql). This bundle is an approval artifact, not an applied/history migration. Customer backfills and legacy column drops are excluded. Reference seeds only insert missing catalog rows. Production execution requires explicit authorization and a verified restore/preflight plan.
- Optional resting-energy CHECK widening is separate review-only SQL. It has not been applied or included in the exact additive bundle test.
- Production lacks `STRIPE_WEBHOOK_SECRET`, Google Calendar OAuth credentials/redirect, `CALENDAR_CREDENTIAL_ENCRYPTION_KEY` and `CRON_SECRET`. Provider acceptance, authorized isolated login/onboarding/save-readback and webhook/invitation/billing checks remain outstanding.
- PHOENIX photo estimation is an explicit 501 stub. Community remains sample-data functionality; calendar reminder delivery, occurrence-only authoring and native-device/provider acceptance remain incomplete.

No production success is claimed for this release candidate. READY preview build status, if obtained, does not establish compatible production database or a complete authenticated customer journey.
