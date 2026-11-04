# Progress redesign review

Base commit: `d76212bc50f7bb5d74bbd1d7e4808a441d7bd947`.

The Progress overview retains member-local 4-week, 12-week and All Time filters. Compact cards retain the Strength, Body, Recovery and Consistency drill-downs. Completed workout counts are now in Getting stronger. The Small steps box and three overview disclosures are removed; assessment routes, history components and private photo handling remain intact.

Nutrition adds hydration, calories, protein, carbohydrate and fat trends and a daily history table. It reuses the shared actual-intake calculation with confirmed meal aggregates and manual entries counted once, without reading targets. Missing/invalid values and failed reads do not become zero. Prepared hydration zero needs saved receipt evidence; positive legacy hydration remains supported. Receipt identities remain server-side.

Cycle trends use only consecutive logged period-start dates, with a preceding start where needed. They count calendar days across DST changes and respect tracking preferences. No predictions, symptom answers, diagnoses or inferred start dates are used. Disabled tracking hides this history.

Recovery totals count distinct days of saved completed actions, valid recorded durations and distinct days of explicit completed check-ins. They reuse shared recovery completion evidence, exclude conflicting action identities and do not count saved sleep or incomplete answer rows as completion. Legacy check-ins without completion evidence stay outside completed-day totals. Untimed full rest can count a day without inventing minutes.

Historical recovery actions and check-ins retain their persisted local `log_date` after a state or timezone change. Completion requires a valid nonfuture timestamp, without converting that timestamp through today's profile timezone. The current timezone continues to determine the current range and new records. No move question or record rewrite is introduced.

Reads are owner-scoped and preserve canonical tier permissions. Sources are bounded to 500 recent records (nutrition uses 500 daily logs and bounded entry batches); caps are labelled. Incomplete nutrition entry batches do not produce partial daily totals. Charts show at most the latest 12 values, with full bounded tables available. Recorded minutes with missing or conflicting evidence are explicitly partial. These are recorded histories rather than verified physiological totals.

## Validation

The original package passed 85 focused tests. The timezone correction adds two regression tests and revalidated all 23 recovery data/UI tests, with no failures (87 unique tests across the package):

| Command | Passed |
| --- | ---: |
| `node --test tests/progressOverview.test.mjs` | 14 |
| `node --test tests/nutritionProgress.test.mjs` | 8 |
| `node --test tests/cycleProgress.test.mjs` | 7 |
| `node --test tests/recoveryProgressHistory.test.mjs` | 15 |
| `node --test tests/progressTrendsUI.test.mjs` | 5 |
| `node --test tests/progressRedesign.test.mjs` | 3 |
| `node --test tests/recoveryProgressHistoryUI.test.mjs` | 8 |
| `node --test tests/strengthProgressHistory.test.mjs tests/bodyProgressHistory.test.mjs tests/progressHistoryUI.test.mjs` | 27 |

`npm run typecheck` passed. `git diff --check` passed. Tests use synthetic data and server-rendered React output, covering range boundaries, missing/error/zero data, duplicates, cross-tier authorization, cycle intervals/preferences, check-in completion and preserved history/private-photo paths.

The new historical-date regression reproduced the original failure before the correction. It verifies unchanged saved dates, completion flags, completed days and minutes across California-to-New York state changes and explicit Los Angeles-to-New York timezone changes. Missing, malformed, impossible calendar dates, day-only and future timestamps remain excluded; owner and tier checks are unchanged.

## Review limits and migration needs

No new database migration is needed. Existing confirmed-only `nutrition_log_totals_by_block`, `macro_entries`, hydration receipt fields and check-in completion fields must already be present. Missing required database sources fail closed as unavailable; their live availability was not queried.

No historical timezone snapshot is stored, so the timestamp's original local-day relationship cannot be reconstructed independently. The persisted, validated historical date is authoritative; this correction does not introduce a move-history mechanism or retroactively change records.

No production database access or changes, deployment, merge, remote Git or GitHub operations were performed. No live member data was used. Browser interaction, visual layout on physical phones/tablets, screen-reader behavior and touch behavior remain unverified. No full production build or authenticated end-to-end test was run.
