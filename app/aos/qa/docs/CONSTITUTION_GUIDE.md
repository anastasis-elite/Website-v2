# Constitution Guide

## Adding A Rule

Add a `ConstitutionRule` to the appropriate domain file. Every rule needs a stable `id`, `domain`, `title`, `description`, `severity`, `enabled`, `provisional`, `inputs`, `expectedBehavior`, `rationale`, and deterministic `evaluate` function.

Use IDs like `WORKOUT-003` or `RECOVERY-004`. Never reuse an ID for a different behavior. If a rule meaning changes substantially, create a new ID and disable the old rule when needed.

## Changing A Rule

Small wording changes can keep the same ID. Changes to expected behavior should be reviewed because historical reports refer to the stable ID. Mark uncertain rules with `provisional: true`.

## Severity

Use `critical` when a user is blocked or unsafe behavior could occur. Use `high` for major incorrect guidance. Use `medium` for meaningful product logic failures. Use `low` for minor or recoverable issues. Use `info` for observations.

## Expected And Actual Values

Each failing evaluation must return `expected`, `actual`, and a clear `message`. The Logic Validation Agent copies those values into the violation so failures can be reproduced without guessing.

## Avoiding Ambiguity

Do not encode vague rules like "make the workout better." Define concrete inputs, deterministic thresholds, and observable actual values from the adapter. If product logic is not final, mark the rule provisional and keep the expectation narrow.
