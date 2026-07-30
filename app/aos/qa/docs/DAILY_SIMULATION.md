# Daily Simulation

## Manual Run

Open `/aos/qa` and click `Run` on Daily Simulation. The default count is 100 personas. You can enter a seed such as `2026-07-30` to reproduce a run.

The same seed and count produce the same personas and scenarios.

## Route Invocation

The AOS-local route handler is:

```text
POST /aos/qa/api/daily
```

Body:

```json
{
  "count": 100,
  "seed": "YYYY-MM-DD"
}
```

The route returns structured JSON with the aggregated report.

## Reproducing A Failure

Use the report `seed`, `personaId`, `scenarioId`, and `ruleId`. Regenerate the same count with the same seed, then inspect the matching persona and scenario. Logic failures include expected and actual values.

## Scheduler

No external scheduler was configured because this task may only modify `app/aos/**`. A future scheduler can call `POST /aos/qa/api/daily` once per day with a date seed.

## Why No Cron Was Modified

Editing `vercel.json`, GitHub Actions, root scripts, middleware, or deployment configuration would violate the repository boundary for this task.
