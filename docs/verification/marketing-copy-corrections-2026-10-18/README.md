# Corrected marketing copy — 18 October 2026

Tested source: `7ab6190d1fb79ff22701414a912a4b541e218815`. Parent candidate: `4b049d530a45e296dbbd8afeadd3b5d97ffc97a0`. Base remains `84b16efd3320ab15625f8dd4566df352d5f12ee4`. Branch `codex/marketing-copy-alignment`, checkout `/private/tmp/anastasis-copy-alignment.zQFD73/Website-v2`. Candidate history is preserved; nothing has been pushed, merged, migrated, deployed, or written to production.

## Changes and preservation

Only three application files changed: home, IGNITE offer and program comparison. The founder’s headline is exact. Home now uses one concise contextual paragraph instead of two, shorter descriptor/question/reassurance text, and the same five question cards and CTA destinations. IGNITE says **“Guidance with more context.”** Comparison uses **“The goal is refined resilience.”**

Independent diff review found no new functional, formula, price, entitlement, route, security, legal or clinical change. Two copy-neutral syntax trees match directly. The home tree differs by exactly one redundant `<p>` and its own styles (including `lineHeight:1.8`, `margin:0`); after explicitly normalizing that exact removal, all three syntax/protected-value comparisons match. No claim that every raw numeric token or all three raw trees are identical is made. See `preservation-final.json`.

## Final verification

- **596 tests passed**, zero failed/skipped; TypeScript passed. Lint and full build passed with **37 warnings** each. Final logs: `tests-corrected-final.log`, `typecheck-final.log`, `lint-final.log`, `build-final-cache-disabled.log`.
- The standard final build compiled and generated pages but hit `ENOSPC` while writing traces. The successful full build disabled only Webpack’s optional filesystem cache in an external verification preload. Server/edge/client override messages are retained. Application/Next source configuration and runtime cache rules were unchanged. `cache-control.cjs` and runner are retained for audit; they use the original local checkout layout. Earlier incomplete tests, cache-hook initialization error and failed build logs are retained and are not pass evidence.
- **18 route capture receipts** at390×844 and1440×1000:14 expected200 and4 expected404. No page errors, document horizontal overflow or clipped action labels. This is nine routes perviewport, not18uniquepages. Full receipts and screenshots: `visual-report.json`, `screenshots/`.
- Console contains18 errors from deliberately blocked service workers,4 expected404 messages and4 local auth-prefetch CSP/RSC messages. No zero-console, installedPWA, realAuth, persistence, pricing or commerce claim. All355 routed requests were localhost reads; API/external/mutation paths are mocked or blocked, with a synthetic server environment and transport guard.
- Root viewed final mobile home viewport and desktop CTA; independent reviewer viewed mobile/desktop IGNITE and full comparison images. No blocking issue in those six saved-image inspections. Retained scripts close contexts/browser in `finally`; owned server exited0 and port3161 has no listener.

## Home CTA position

| Viewport | Prior candidate y | Corrected y | Higher by | Earlier baseline y |
|---|---:|---:|---:|---:|
|390×844|1537.50|1363.42|174.08px|1484.31|
|1440×1000|1229.98|1117.42|112.56px|1143.98|

The introduced distance is recovered at both sizes. **The primary CTA remains below the fold.** No broader layout redesign or closure of the manual’s no-scroll requirement is claimed. Prior/baseline coordinates come from the independent review’s synthetic comparison; current coordinates come from the actual corrected production build.

[Mobile home](screenshots/mobile-home-viewport.png) · [Mobile CTA](screenshots/mobile-home-cta.png) · [Desktop home](screenshots/desktop-home-viewport.png) · [Desktop CTA](screenshots/desktop-home-cta.png) · [Mobile IGNITE](screenshots/mobile-program_ignite-viewport.png) · [Desktop IGNITE](screenshots/desktop-program_ignite-viewport.png)

## Proposed link corrections — not applied

| Current action | Observed | Proposed existing destination |
|---|---|---|
|PHOENIX support Continue → `/program/phoenix/support/apply`|404 in both viewports|**Compare current programs** → `/program`|
|Guide Join The Waitlist → external checkout URL|Not opened; waitlist semantics unverified; no local waitlist handler|**Explore current programs** → `/program`|
|Guide Return to Application → `/apply`|404 in both viewports|**Take the Capacity Audit** → `/audit`|

Both proposed destinations render200 and are existing public pages. These create no waitlist, human-support service, payment arrangement or commerce activation. `proposed-links-NOT-APPLIED.diff` is a reviewable proposal only; current source links remain byte-identical. Parent direction is required before applying functional link changes. Two other existing `/apply` references remain in support-first and medical-clearance pages; no clinical instruction or route was silently changed.

## Remaining acceptance limits

The belowfold primary action, existing broken/unverified destinations and inherited EMBER micronutrient enforcement gap remain. Existing ovulatory wording is untouched. Live isolated Auth/API/RLS, persistence, realpayment/email/provisioning/provider, native/fulljourney and physicalPWA acceptance remain unrun; strength migration remains unapplied. Parent owns the existing ledger. This is a local copy-review candidate, **not production release approval**.

`report.json` contains exact source hashes, checks, scope and limits; `changed-assets.csv` records the three revised copy assets. Logs have only newline/trailing-whitespace normalization. The first-copy desktop distance assertion failed and is retained separately (`visual-report-first-copy.json`); final passes are in `visual-report.json`.

Founder priority is EMBER launch readiness. This handoff closes the bounded copy correction only; broader IGNITE/PHOENIX polish is deferred. Parent task-1 owns consolidated EMBER functional/schema/isolation gates. No shared checkout was changed.
