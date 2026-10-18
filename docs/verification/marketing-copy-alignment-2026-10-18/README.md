# Marketing copy alignment — 18 October 2026

Local review candidate on `codex/marketing-copy-alignment`, based on verified remote main `84b16efd3320ab15625f8dd4566df352d5f12ee4`. Tested source commit: `2181d0294a3699f0d7ce33ab8f63b1023896ef1e`. No push, merge, migration, deployment, provider, payment, email or real-member operation occurred.

The complete four-page, 225-line founder manual was read through Library: `libfile_ad440f60bf308191820c6ddddbfef35c` / `file_000000005e7c81fdabdb8aeabee6eb1f`, **Anastasis_Marketing_Verbiage_Manual_v1.docx**, v1.0, 18 October 2026. Parent explicitly accepted that text and waived local DOCX materialization; no replacement manual was made. This report supersedes the earlier inventory-only preparation status.

The home hero uses the established founder wording: **“You carry enough. Your health shouldn’t be one more thing you have to figure out.”** The manual’s alternate hero remains an example, not an override.

## What changed

68 source files and two visible-text test expectations changed. Public platform pages, program offers/recommendations/enrollment, audit results and auth copy now use concrete available tools, respectful member choice and conditional success language. Member assessments, nutrition, recovery, workouts, daily guidance, account, preview community, navigation, SEO and tutorials distinguish saved records and estimated guidance from unsupported staffing, clinical outcomes, automation, photo estimation or provider availability. EMBER explicitly excludes food/meal logging and micronutrient tracking/guidance. PHOENIX recipe suggestions remain distinct from photo estimation (currently unavailable), specialized tracks, and the wider concierge vision.

The source syntax tree structure is unchanged in all 68 files after masking copy literals. Separately checked numeric literals, route/URL strings, functional JSX attributes, module strings, predicates and database call strings also match. Protected formula, entitlement, commerce, security, legal, migration, config and dependency paths have no diff. These checks and independent diff review support behavior preservation; they do not prove live operation or founder numeric fidelity.

## Verification

- Full isolated suite: **596 passed, zero failed or skipped** (`tests-final.log`). The initial two failures referenced old display text; only those expected strings changed. Save/retry/refresh and HTTP-status assertions remain.
- TypeScript: passed (`typecheck.log`). Lint: passed with 37 warnings (`lint.log`). Final clean build: passed with 37 warnings (`build-final-clean.log`). `git diff --check`: passed.
- Build retry hit local `ENOSPC` while caching (`build-final.log`); clearing only this checkout’s generated `.next` directory allowed the final clean build to pass. Earlier build also passed (`build.log`). No source/config change bypassed the error.
- Generated HTML text checks passed for home, the three offer pages, guide and support-first (`static-output-checks.json`); the retained runner also passed its targeted smoke check (`retained-runner-check.log`). These are not browser interaction checks.
- All checks used a clean checkout without environment files, synthetic service endpoints, stripped production credentials and a fail-closed Node transport guard. No old production-connected scripts or live operations ran. The guard is not an OS network sandbox. No new browser/physical-device acceptance is claimed.

## Review and acceptance limits

- **EMBER enforcement gap:** current main still returns micronutrient data/guidance (`app/api/nutrition/route.ts:42`, `app/api/nutrition/nutrient-insights/route.ts:24`) and retains inherited UI exposure, despite the required copy exclusion. This pass preserves gates and does not incorporate held functional fixes. Resolve and accept separately before public release.
- **Destinations:** guide’s unchanged checkout-domain “Join The Waitlist” link is unverified (`app/guide/page.tsx:131`). Existing Phoenix support destination `/program/phoenix/support/apply` is missing in this tree. No routes were changed.
- **Clinical wording:** existing ovulatory-window advice remains untouched (`app/dashboard/assessment/start2/Start2Content.tsx:108`); retain founder/qualified review.
- Live isolated Auth/API/RLS, payment/email/provisioning, provider integrations, native persistence, physical PWA and complete member-journey acceptance remain unrun. Current iCloud credential-flow mismatch remains separate. Strength migration is still unapplied. Held combined work is not part of this branch.

**Suitable for founder copy review and the next isolated acceptance stage; not production release approval.** Parent owns the existing task ledger; this report records limits rather than creating another backlog. No permission denial or uncertain external action remains in this copy task.

## Evidence

Retained log text has normalized newlines and trailing whitespace; diagnostic messages and results are unchanged.

`report.json` contains scope, manual identity, validation and limits. `changed-assets.csv` / `.json` record each changed source asset’s channel, objective, audience, claim/evidence, CTA/destination, tier, availability and approval status. `route-inventory.json` inventories 99 routes and distinguishes direct edits from shared surface effects. `preservation.json` records each source comparison.

Reproduce from this repository after installing compatible dependencies in an isolated environment:

```sh
node docs/verification/marketing-copy-alignment-2026-10-18/run-isolated.mjs test tests/*.test.mjs
node docs/verification/marketing-copy-alignment-2026-10-18/run-isolated.mjs typecheck
node docs/verification/marketing-copy-alignment-2026-10-18/run-isolated.mjs lint
node docs/verification/marketing-copy-alignment-2026-10-18/run-isolated.mjs build
node docs/verification/marketing-copy-alignment-2026-10-18/review-preservation.cjs
```

The Node transport guard was copied unchanged from the earlier local Package A QA harness and is retained here for reproducibility. It is documentation/test tooling only; it does not alter application runtime behavior.
