# Anastasis QA Architecture

This first implementation creates an internal QA framework entirely inside `app/aos/qa`.

## Agents

The Functional QA Agent checks technical behavior through a `PlatformAdapter`: route availability, action completion, response shape, invalid transitions, missing data, inaccessible actions, navigation definitions, and persistence. The default adapter is a safe mock. A future browser or application adapter should implement the same interface.

The Logic Validation Agent receives a synthetic persona and scenario, asks the adapter for the actual platform outcome, evaluates enabled Constitution rules, and emits structured violations when expected and actual behavior differ.

The Experience QA Agent scores finite user-experience evidence exposed by the adapter. It measures decision load, action load, clarity, confirmation, continuity, form density, repeated requests, unavailable next actions, and workflow interruptions. It does not use an LLM as the source of truth.

## Constitution

The Constitution is a TypeScript rule set with stable IDs, domains, severities, enabled flags, inputs, expected behavior, rationale, and deterministic evaluation functions. It lives in `app/aos/qa/constitution`.

Rules marked `provisional: true` are examples or early product assumptions. They require product-owner validation before they should be treated as final Anastasis logic.

## Persona Generation

`personas/persona-generator.ts` uses a seeded linear congruential generator, not `Math.random`. The same seed and count produce the same personas. `scenario-generator.ts` derives stable scenarios from those personas.

## Adapters

`PlatformAdapter` isolates the QA framework from the real application, browser tooling, and persistence. `MockPlatformAdapter` is the default and makes no external calls. Real browser, app, or Supabase-backed adapters should be added later without changing the Constitution contract.

## Runners

`daily-simulation-runner.ts` generates 100 personas by default, runs functional checks, runs logic and experience checks per scenario, caps concurrency, records scenario failures as report data, and saves an aggregate report in memory.

## Reports

Reports include run metadata, pass/fail totals, severity totals, agent totals, rule totals, top failing rules, top friction points, violations, errors, and adapter name. The in-memory store is temporary and scoped to the current server process.

## Data Flow

Seed and count enter through the dashboard, server actions, or AOS-local route handlers. The runner generates personas and scenarios, agents query the adapter, Constitution rules evaluate behavior, the report builder aggregates results, and the dashboard renders the latest report.

## Implemented

Implemented now: typed Constitution, provisional example rules, deterministic persona and scenario generation, mock adapter, three QA agents, daily simulation runner, in-memory reports, AOS-local route handlers, server actions, dashboard, and local self-check module.

## Remaining Connections

Remaining work requires external integration: real browser/app adapter wiring, persistent report storage, production authorization helper reuse, and an actual scheduler calling the AOS-local daily route.
