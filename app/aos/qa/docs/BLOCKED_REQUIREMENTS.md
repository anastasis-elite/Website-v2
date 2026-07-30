# Blocked Requirements

The following items were intentionally not implemented because they require changes or integrations outside `app/aos/**`.

## Real Daily Scheduling

A real daily scheduler would require editing deployment configuration, `vercel.json`, GitHub Actions, an external cron service, or another root-level scheduling system. This implementation exposes `POST /aos/qa/api/daily` for a scheduler to call later.

## Real Browser Or Application Adapter

Playwright, Cypress, browser setup, global test configuration, or app-wide route knowledge would require files outside `app/aos/**`. The framework uses `PlatformAdapter` and `MockPlatformAdapter` so a real adapter can be added later.

## Database-Backed Report Persistence

Persistent report storage would require a database table, Supabase migration, or shared data-access layer outside `app/aos/**`. This implementation uses an in-memory report store with a `ReportStore` interface.

## Production Authorization Integration

The parent AOS layout already enforces AOS access, but adding or changing a production authorization helper would require shared auth code outside `app/aos/**`. The QA route handlers are marked internal by location and documentation but do not modify global auth.

## Root Test Script Integration

Adding a root test command or global test configuration would require changes outside `app/aos/**`. A local self-check module is provided in `app/aos/qa/self-check/run-self-check.ts`.
