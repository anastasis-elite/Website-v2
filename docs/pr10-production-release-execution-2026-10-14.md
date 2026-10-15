# PR #10 production release execution — October 14, 2026

The user's current release instruction supersedes the earlier HOLD/no-publication instructions in the historical readiness reports. Commit/push, an exact-source preview, authenticated acceptance, and controlled production promotion are authorized. Production SQL requires separate explicit approval. Merge/promotion remain conditional on that approval/application and passing authenticated release gates.

## Release scope and isolated limitations

The cumulative PR includes daily persistence repairs, direct water/manual/barcode logging, persisted micronutrient rings, mobile navigation, and PWA startup/update improvements. EMBER retains guidance, hydration and its established aggregate macro path; IGNITE retains manual/barcode food entry; PHOENIX retains its expanded capabilities. No tier assignment or billing record is changed to manufacture test coverage.

Photo estimation is an isolated unavailable feature. The Photo entry is disabled unless the authenticated backend explicitly returns available:true. Unknown/error/unavailable states show a clear explanation and manual/barcode fallback. The upload handler also requires availability. PHOENIX's entitlement flag remains intact; HTTP 501 is not represented as successful image analysis. The user explicitly permits this limitation to accompany the release.

The production commerce dependency gap predates the mobile release and is fail-closed. Its reviewed repair proposal is retained as separate preparatory work and is **not approved for application in this release**. No checkout, subscription, webhook replay, customer claim, invitation or payment acceptance operation is part of smoke testing. The completed source contract/confirmed-email guards remain fail-closed while those dependencies are absent. This limitation is documented, not reported as repaired.

## Production SQL approval packet

- Target: Supabase project `lcccpqgnpznhbtmkmytp`, **anastasis-elite's Project**, region `us-east-1`, PostgreSQL 17.6.
- Exact SQL: [`sql/pr10-nutrition-entitlement-guard.sql`](sql/pr10-nutrition-entitlement-guard.sql).
- SHA-256: `d66decc34d9fd178466a200decafc303c31eb828bc3fac33c1fb9d85d5171664`.
- Fresh independent catalog review confirms missing access helper/legacy-meal trigger and legacy `food_log_items` RLS disabled with dangerous browser-role administration grants.
- Adds an invoker helper checking stored owner/tier/access/active/expiry, an invoker legacy-meal trigger, and 24 restrictive mutation policies across eight nutrition tables. Existing permissive and restrictive policies continue to intersect.
- Revokes `TRUNCATE`, `REFERENCES` and `TRIGGER` on `food_log_items` from PUBLIC/anon/authenticated. RLS alone does not protect TRUNCATE.
- No customer backfill/deletion, entitlement/billing/subscription update, permissive grant, security-definer function, or SELECT policy change. Historical JSON stays unchanged on water/target edits; existing canonical-history tier read restrictions are preserved.
- Scope limit: direct hydration/general target writes retain existing owner checks. Application middleware supplies active-member enforcement there; this migration specifically guards paid food/macro mutations.
- Transactional/replay rehearsal and real anonymous/authenticated TRUNCATE-denial tests pass. Production application is pending explicit approval; no blind db push or historical commerce migration replay.

## Validation before publication

- Web regression: **563 passed**, zero failures/skips.
- Native calendar regression: **8 passed**.
- Web/native lint and nonincremental TypeScript: passed; existing warnings remain.
- Local production build: passed with explicitly fake Supabase/Stripe/Resend service configuration; no remote customer connection. Deployed builds must still pass using the intended Vercel environment.
- Exact original P0 SQL rehearsal: passed twice in a disposable reconstruction.
- Final repair SQL regression: **11 passed**, including real role-denial/history tests in an isolated database.
- Final image/mobile/nutrition/PWA focused checks: passed.
- Whitespace: clean.

Fixtures/source review support tier boundaries, direct entry, hydration same-ID retry/readback, persisted nutrient calculations and mobile navigation. They do not replace authenticated deployed acceptance.

## Deployment and rollback gates

- Vercel team `team_9IlTosdiNM1LIWUEalcToj38`; project `website-v2` / `prj_t7uI7hI0KMynF4hkh0iEbmyKpOUH`.
- Fresh baseline production: `dpl_H2y47KZPFwoYPfXgWtkzNQN77bVY`, source `f5d2a71578783855f9a1cef39a68f499547327a9`, serving `https://anastasiselite.com` and its existing aliases. Preserve this as rollback target and reverify before promotion.
- Confirm automatic production-domain assignment is held before any operation that could cause a production deployment. Keep live aliases on baseline until staged acceptance passes.
- Publish completed source to existing `codex/coordinated-daily-dashboard`; verify the preview READY metadata matches the exact Git head.
- Authenticate normally through Vercel protection and Anastasis using the existing authorized account. Preview shares the production Supabase target, so ordinary confirmed health saves are real account writes. Preserve history and record intended actions; do not change membership to test other tiers.
- Verify login/routing, direct entry, hydration save/readback/refresh/reopen/retry, available meal methods, micronutrient coverage/rings, mobile navigation and PWA assets. Fixture results cover unavailable tiers; record live tier limits explicitly.
- After approved SQL and all blocking gates pass, merge only validated head; build the exact resulting merge SHA with production settings while aliases are held. Verify READY identity, unchanged baseline aliases, authenticated staged behavior and logs; promote that already-tested production artifact without rebuild.
- Reverify production aliases/SHA, authentication, hydration persistence, navigation, nutrition entitlements and errors. Roll application traffic back to the recorded baseline on data loss or a functional release blocker; preserve additive SQL and browser receipts/drafts.

## Remaining follow-ups

Installed-iPhone cold/warm/resume performance and connected-calendar provider acceptance remain unmeasured. Numeric nutrient/UL reference rows remain absent and must display unavailable rather than fabricated values. Optional calendar/midnight refreshes can duplicate. Older multistatement daily saves and append paths retain documented partial-write/uncertain-response limits. Existing leaked-password-protection advisor warning is unchanged.

Operational evidence (final Git SHA, exact deployment identity, approved migration record and authenticated results) must be recorded after the corresponding action succeeds. No production promotion is claimed by this preparation document.
