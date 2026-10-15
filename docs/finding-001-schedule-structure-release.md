# Finding #001: Schedule Structure Assessment

The assessment now has a **Complete Assessment** action. Only a successful owner-scoped database save records completion, refreshes Schedule and dashboard data, and returns to the next eligible action. Reopening a completed assessment shows its saved answers and keeps its completion.

## Architecture and scope

- Uses the existing `/api/daily-structure` endpoint, `clients` preference fields, `daily_structure_reviewed_at`, and `clients.onboarding_data` persistence.
- Answers and completion evidence are saved together with `updateOwnedOnboardingData`'s compare-and-swap, preserving concurrent dashboard and Schedule preferences.
- The existing monthly Daily Structure Review is projected into the shared Schedule as `schedule-structure:YYYY-MM`. It reuses the existing monthly `standalone:YYYY-MM` assessment record. Previously completed monthly reviews are respected; a matching saved assessment event prevents a duplicate monthly task.
- Explicit saved assessment tasks retain their own task/version identity. Schedule derives completion from valid persisted answers, using the same recorded-activity projection pattern as other dashboard activities.
- Repeat submissions preserve the original answers and timestamp. Invalid input, offline/error responses, ownership failures, version conflicts, and exhausted concurrent-write retries cannot falsely complete or advance the assessment.
- Existing calendar-change notifications, dashboard-layout invalidation, visibility/focus refresh, and network-first authenticated PWA navigation synchronize readers. Browser storage is not completion evidence.
- Completed Schedule entries include **Review assessment**. Completing the form does not complete work, school, or imported calendar commitments.

No database migration is required. Read-only production catalog checks confirmed the existing fields and RLS on the two relevant tables. Billing, entitlements, subscriptions, and unrelated SQL/release artifacts are excluded.

## Validation

Validation covers the real production-style empty schedule tables, monthly projection, saved tasks, owner-scoped atomic persistence, duplicate/retried submissions, concurrent saves, failed persistence, What’s Next advancement, completed Schedule/dashboard state, fresh-reader/PWA restart behavior, read-only reopening, and client-local month rollover. The full regression suite also includes the existing PWA worker and refresh tests.

Release follows the established workflow: scoped commit and branch push, reviewed pull request to `main`, exact-source production build with automatic custom-domain assignment held, authenticated staged checks, then promotion of that same production artifact and verification of live aliases and commit identity.

Production verification intentionally leaves the member's assessment available for their own iPhone test; no invented answers are submitted to a real member record.
