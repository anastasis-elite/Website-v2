# Anastasis customer-journey audit — 12 October 2026

This report separates implemented code and isolated verification from real provider/customer verification. No live payment or founder-account health writes were performed.

## Previous work and integration

- Branch: `codex/coordinated-daily-dashboard`; origin: `anastasis-elite/Website-v2`. No repository or ancestor `AGENTS.md` was present.
- Existing unpushed dashboard and nutrition commits `2383c03` and `f79f9aa` were retained. Local connected-calendar/mobile work was preserved in `ce5dc98`.
- Latest remote main `d887751`, including `dd6cf69` nutrition fixes, was merged in `3137ae9` and pushed. Conflicts retained independent meal input identities, photo entitlement handling, and earlier daily/calendar functionality.
- Before integration, tracked patches, untracked files, and all branch history were backed up under `/private/tmp/anastasis-audit-preservation/`. Eight existing stashes remain intact. Bundle heads were compared with the integrated history; relevant heads are already ancestors or patch-equivalent.
- Older AOS marketing/nutrition helper drafts remain in stash 4 and were not represented as integrated. The unrelated local About page, generated TypeScript cache, and Supabase temporary files are excluded from these commits.
- No reset, discarded local revision, force-push, committed secret, or production migration was used.

## Implemented behavior

- A shared daily-training recommendation distinguishes normal training, reduced capacity, and recovery-only days. Dashboard, workout, recovery, and schedule consume current daily inputs. Missing and partial check-ins are explicitly unconfirmed. Mutation, focus, local-midnight, and event-boundary refreshes update dependent screens.
- Workout controls and saved units distinguish strength sets/reps/load, zero added bodyweight load, cardio time, breathing breaths/time, and mobility time/completion. Resume reconciles server records with newer unsaved drafts. Changed same-day plans preserve prior sessions and historical dates.
- Schedule commitments open the corresponding event detail/action. Work, school, appointment, and custom events do not route to hydration. Overdue/current/later priorities and deferred dates agree across schedule and dashboard; completion is distinct from skipped/canceled states.
- Existing Google OAuth, iCloud CalDAV, and native device-calendar work was preserved and completed with visible connection controls, calendar selection, explicit write destinations, imported commitments, recurrence, all-day/timezone handling, retries, cancellation/update handling, disconnect, authorization and sync-error states. Tokens remain encrypted/server-side and database ownership is tested. Android calendars are identified by their actual account/source. ICS remains accurately labeled as an export/subscription capability.
- EMBER product and cart describe the supported member assessments, training structure, nutrition targets, recovery guidance, hydration and progress tracking. EMBER does not include manual/barcode/photo meal logging. IGNITE/Phoenix manual/barcode paths remain independent; Phoenix photo entry also depends on server-confirmed availability.
- Stripe-backed pricing displays configured amounts/currencies/intervals before checkout. Pay-in-full requires explicit metadata duration. Checkout blocks incomplete activation setup and unsafe live/test environments. Purchase ownership uses a secure browser capability or verified login; signup links are delivered to the receipt email. Atomic fulfillment, webhook replay/failure/current subscription state, subscription overlap guards, expiry, protected entitlement/billing fields, and owned portal access are implemented. Canceled members can reach billing; gifts remain separate.
- Public Capacity Audit timing is consistently about 1–2 minutes for five broad questions. It is distinguished from the fuller member assessment. The server validates the actual choices/consent, derives the result, ignores forged scores, and only reports completion after persistence succeeds.
- A new support page gives the approved contact and practical support/billing/cancellation instructions. It makes no unsupported response-time promise. The refund page's internal editorial note was removed while approved policy wording was preserved.
- Fresh-member profile routing, initial/strength assessment validation, owned plan creation, saved-baseline retry, equipment filtering, and consistent nutrient formulas were repaired. Unsupported catalog exercises are excluded with an equipment-review note; the existing catalog is not certified as a complete home/bodyweight program for every equipment selection. Saved training availability does not replace template calendar structure.

## Isolated evidence

- Full repository tests: **367/367 passed**, zero failures/skips. Native calendar tests: **8/8 passed**. Isolated payment handlers additionally cover real route signatures, webhook replay/failure, secure invitation delivery, inactive billing access, and actual SQL rollback/ownership/subscription overlap.
- Actual SQL executed in isolated PGlite PostgreSQL: daily dashboard atomic writes, idempotency, history, calendar ownership, member program ownership and workout history. Two-user and anonymous denial checks pass, including an older permissive policy.
- Real API handlers with replaced auth/database/provider transports: onboarding and saved-plan retry, workout units/save/reload, public audit validation/results, manual nutrition boundaries, calendar updates and failures. These are integration tests, not a real Supabase customer.
- Browser: 30 checks passed at 390×844, 820×1180, and 1440×1000 with `America/Chicago`. They cover dashboard/workout/schedule layouts, unit-specific activity completion and reload, independent IGNITE manual meal save/reload, EMBER logging restrictions, checkout/cart navigation and failure feedback, audit validation, and support layout. Pricing and persistence were explicitly simulated. Screenshots/results are in `/tmp/anastasis-audit-browser/`.
- Chicago spring and fall transitions, 23/25-hour workout-day bounds, recurring/all-day events, and extreme viewer timezones have automated coverage.
- Type checking passed and lint passed with pre-existing warnings. Temporary development QA routes and fake environment configuration were removed before final build.

## Chloe's six checks

| Check | Complete customer result | Evidence / blocking requirement |
| --- | --- | --- |
| 1. Checkout | BLOCKED | Isolated checkout UI tested; real Stripe test payment, configured catalog and webhook delivery still required. No live charge was made. |
| 2. Account creation/login | BLOCKED | Authorization/ownership handlers tested locally; real payment-to-invitation/login on an isolated Supabase environment required. |
| 3. Complete onboarding | BLOCKED | Real handlers/templates and owned SQL pass isolated tests; real fresh EMBER database persistence/new-session reload required. |
| 4. Personalized workout/nutrition guidance | BLOCKED | Generated template/load and nutrient formulas pass local integration; complete fresh-customer flow and equipment catalog review required. |
| 5. Activity/progress/dashboard | BLOCKED | Activity units, server resume and SQL history pass; browser simulated save/reload passes; isolated real database and dependent-screen verification required. |
| 6. Support/billing/cancellation | BLOCKED | Customer support layout/contact pass; real owned paid-account Stripe portal/cancellation and gifted-account comparison required. |

IGNITE manual meal entry passed independent browser search/serving/save/reload with simulated persistence. Real isolated Supabase persistence remains blocked; barcode success is not substituted for manual-save evidence.

## Remaining configuration and business decisions

- Provide a separate Supabase test project/usable branch. The connected project is production; its only listed default branch reports `MIGRATIONS_FAILED`. No isolated environment was available.
- Apply reviewed pending migrations to that environment in repository order. Production schema inspection showed calendar tables and newer dashboard RPC/columns absent. The CLI-created `20261012173013_member_program_ownership_and_workout_history.sql` packages the tested member ownership/workout additions; no live DDL was performed.
- Configure Stripe test-mode keys, matching test price IDs, webhook signing secret and endpoint, billing portal, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, the verified `onboarding@anastasiselite.com` sender domain, and test customers. Apply `20261012174637_secure_checkout_fulfillment_and_billing.sql` to the isolated database. Exercise successful/failed payment, cancellation, returning users, webhook replay/out-of-order delivery and unauthorized access against the real services. Guest checkout fails closed without email delivery setup.
- The deployed read-only `/api/pricing?program=ember` returned HTTP 200 and confirmed **USD 360 per month** and **USD 3,600 one-time** from configured Stripe objects. Pay-in-full access duration is absent, so that option is disabled. Explicitly configure the approved duration in price/product `access_months`; no duration or savings is inferred.
- Configure Google Calendar client ID/secret, exact redirect URI, consent approval, calendar credential encryption key, and `CRON_SECRET`. Test actual Google/iCloud accounts and native devices; default automatic refresh is daily at 06:00 UTC, with on-demand refresh available. iCloud requires the user's app-specific password; Android device permission is separate from provider cloud synchronization.
- No approved support response timeframe was found. Do not add one until approved. No new refund terms or cancellation commitments were invented.
- Code push, preview deployment, production deployment, and complete customer verification are separate states. Production readiness is not established by this report.

## Push and deployed evidence

- Implemented code commit `9d756f33b6d48b6ddcd80785a265cdecb386561e` is pushed to `codex/coordinated-daily-dashboard`. [Draft PR #10](https://github.com/anastasis-elite/Website-v2/pull/10) is open against main.
- Vercel preview `dpl_956KTqSEvFxWj827HBinuTagUD39` reached **READY** for that exact commit: [preview](https://website-v2-bflcn7xc3-youtopiatx-5548s-projects.vercel.app). Pricing and support returned HTTP 200 through existing protected-deployment access. An unauthenticated workout API check returned 401, but the fetch helper classified it as an authentication barrier and did not expose the application response; it is not complete ownership/provider verification.
- Production remains READY on main commit `d8877518edd4c9d0efe35421863e5b7ab465ffc2`. The fixes have not been promoted to production or applied to its database.
- The final report-only follow-up commit records these deployment observations; no application code changes after the tested implementation commit.
