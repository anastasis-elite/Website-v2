# Schedule responses and breakfast review

Base commit: `d76212bc50f7bb5d74bbd1d7e4808a441d7bd947`

This local change adds explicit occurrence responses and an optional breakfast
time. Overdue Today prompts ask whether the member completed the item or is
still in progress. Saved in-progress responses are acknowledged; elapsed time
never supplies completion. Current commitments, accepted rescheduling, future
events and existing safety/health priorities keep their existing order.

## Behavior and persistence

- Today provides In progress and Completed responses for eligible scheduled
  occurrences. Schedule retains its completion checkbox and adds In progress.
- Responses belong to the authenticated owner, member, selected local date and
  occurrence ID. Desired-state writes retain revision comparisons and operation
  IDs for concurrent requests and retries after a lost response.
- In progress does not award completion or streak credit. Generic schedule
  responses do not write health logs or provider calendar records. Authoritative
  completion remains protected from a stale schedule response.
- Assessment and routine editing both save/reopen an optional breakfast time.
  Breakfast is stored in the revision-protected routine JSON snapshot, avoiding
  a new client profile column. Legacy submissions that omit breakfast preserve
  a later preference; an explicit empty value clears it. Submitted assessment
  evidence remains immutable.
- Breakfast projects independently for the selected local date. Its response
  records attendance only, without food, calories, macros or health credit.
  Skipping or moving it cannot hold Nutrition. All tiers open its Schedule
  destination, while ordinary meals retain their logging routes.
- Breakfast completion saves the effective occurrence timing. Completed
  snapshots remain visible after the routine time changes or is cleared.
  Future breakfast occurrences retain distinct date-based identities.

## Migration review required before release

`supabase/migrations/20261104184614_schedule_occurrence_responses.sql` extends
`schedule_occurrence_checkoffs` with response status and an optional breakfast
timing snapshot. It backfills existing boolean evidence, enforces consistent
completion fields, and keeps legacy boolean writers compatible during a rolling
release. The ownership RLS policies, grants and deletion cascades from
`20261028190000_schedule_occurrence_checkoffs.sql` remain in place.

Apply the new migration through the approved database release process before
releasing the new response writers; first verify its prerequisite table
migration is present. Neither migration was applied to production in this task.
The new migration was executed only in disposable PGlite PostgreSQL tests,
including RLS and old-writer compatibility checks. The migration filename was
prepared manually because the CLI attempted to write its state directory in a
read-only home directory.

## Verification

125 focused tests passed, with zero failures:

```sh
node --test tests/scheduleCheckoffs.test.mjs tests/breakfastSchedule.test.mjs tests/routinePreferences.test.mjs tests/scheduleStructureUI.test.mjs tests/scheduleOccurrencePrompts.test.mjs tests/scheduleEngine.test.mjs tests/scheduleRecommendation.test.mjs tests/todayCompletionStateCopy.test.mjs tests/todayNutritionScheduleIntent.test.mjs tests/scheduleReviewUI.test.mjs tests/todayServerViewModel.test.mjs tests/todayStreakProgressDialog.test.mjs tests/guidedTodayUI.test.mjs
```

Coverage includes timing and priority, accepted rescheduling, occurrence identity,
reload persistence, duplicate/conflicting saves, member-local midnight, DST and
distant timezones, breakfast save/reopen and clearing, completed history, source
calendar isolation, health/streak boundaries, UI retries and unavailable storage.
`npm run typecheck` and `git diff --check` also passed. Independent code review
found no remaining blocking issues.

## Release limits

This is a local review candidate. No GitHub operation, push, merge, publish,
deployment or production database write was performed. Browser and production
integration smoke tests remain for the approved release environment. Existing
notification settings are unchanged; lock-screen reminders and quiet hours are
outside this package.

The delivered file is an exact `git format-patch` export of the local commit.
Review or apply it against the base SHA above using the normal local Git review
process.
