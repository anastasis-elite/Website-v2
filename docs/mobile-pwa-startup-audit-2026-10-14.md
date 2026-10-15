Startup work for the mobile UX and PWA release preserves the existing member authentication, legal/safety gates, tier checks, hydration RPC, and database schema. No user activity or authenticated HTML is cached by the service worker. No production database, billing, or entitlement changes were made.

The original path verified authentication and the client in middleware, then repeated the application member lookup independently in the layout and page. It loaded the daily plan, broad program logic inputs, a privileged recommendation-audit append, and three serial schedule sources before rendering the day. Schedule initialization rebuilt the already-loaded daily plan. Every minute and every focus/visibility event could trigger another full server refresh. Production JavaScript assets were network-first even when their exact content-addressed URL was already cached. The PostHog package was included in the initial dashboard JavaScript.

Implemented changes:

- React request-scoped identity deduplication shares verified reads between the server layout and page. Each caller still enforces its own access and onboarding gates; member data is never placed in a cross-request cache.
- The authenticated layout sits behind a Suspense boundary with a nonpersonal black-and-copper shell. After the page’s existing tier and safety checks complete, a second shell exposes check-in, direct water logging, and the entitled nutrition destination while the personalized day loads. It does not claim that anything has been saved.
- Independent daily-plan reads run in parallel. Sleep, cycle, nutrition totals, confirmed meal entries, manual macros, and signed photo reads no longer form an avoidable serial waterfall. Optional photo preview failures cannot reject primary daily actions.
- The schedule reuses the daily plan, loads its three independent sources in parallel, and the daily dashboard applies a two-second budget to each optional schedule source. Missing sources are explicitly marked; their data cannot be treated as conflict-free time. Schedule mutation APIs retain their full source verification.
- Recommendation-audit work runs through Next’s supported `after` lifecycle. The existing audit helper still verifies authentication and client ownership before constructing its privileged append transport.
- Detailed calendar code loads only when the member expands it and has an independent failure boundary. Charts and other details mount only when their disclosure opens. Collapsing the parent unmounts the optional calendar fetch.
- PostHog downloads after startup through an idle dynamic import. The existing sanitized capture API is retained with a bounded memory-only pending queue; optional analytics failure cannot reject a daily action.
- Full dashboard polling every minute was removed. The member-local daypart and event timers remain; one timezone-aware midnight timer also refreshes nutrition and all other dashboard pages. Passive focus/visibility refreshes coalesce; confirmed saves still refresh immediately.
- Exact hashed Next static assets use cache-first reads; development filenames and mutable icons retain network reads. Deployment query strings remain part of cache identity. Existing caches, drafts, queues, saved activity, and explicit update-consent behavior remain intact.

Measured evidence is deliberately separated from device startup evidence:

| Evidence | Before | After | Limits |
| --- | ---: | ---: | --- |
| Existing local build: union of root, dashboard layout, and program initial JavaScript | 914,113 raw bytes / 270,367 gzip bytes | 707,033 raw bytes / 203,648 gzip bytes (24.7% gzip reduction) | Baseline is a pre-existing local artifact, with its build timestamp and asset inventory saved in `mobile-pwa-bundle-baseline-2026-10-14.json`; it is not a device trace. |
| Optional schedule loader, five samples with a disposable 40 ms latency per read | 4 transport reads, serial dependency | 3 transport reads, independent sources | Actual measured sample durations are in `mobile-pwa-loader-latency-2026-10-14.json`. This is a synthetic Node experiment, not browser, Supabase, or installed-PWA startup latency. |
| Real mobile cold/warm/resume startup | Not captured here | Not captured here | No real device was available to this worker. The 1/2/3-second acceptance goals remain unverified. |

Local timing instrumentation does not send telemetry or persist data. `anastasis:navigation-to-shell` records streamed shell DOM availability after two animation frames through a fixed inline script; this is a paint proxy to check against FCP and screenshots. `anastasis:navigation-to-primary` records committed primary-action UI after hydration and two animation frames. `anastasis:navigation-to-secondary` records the complete personalized day after hydration and two frames. `anastasis:resume-to-secondary` measures the resumed server refresh through the new schedule snapshot. These marks can be read with `performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('anastasis:'))`. Cold/warm runs require separate full document navigations; in-app navigation elapsed time must not be reported as a fresh startup. Primary-action latency still needs an actual input interaction check. Unsupported timing APIs fail silently without affecting activity saves.

The reproducible synthetic loader command is `node scripts/measure-dashboard-loader.mjs 109501c96e0aaf7cd6a76b832c7219af42cd772f`. It reads the original loader from Git, substitutes disposable read transports, and writes all ten samples and the actual medians. It does not access Supabase or a real member.

Prioritized remaining defects and evidence gaps:

| Priority | Item | Acceptance consequence |
| --- | --- | --- |
| P1 | Real-device browser and installed-PWA cold, warm, and resume traces remain absent. | Do not declare the PWA problem resolved, or the timing goals met, until representative device measurements show improvement. |
| P1 | Authenticated production Supabase query/RPC timings have not been measured by this worker. | Capture individual network timings, failures, and counts using the designated acceptance account. Synthetic loader gains cannot establish production query latency. |
| P2 | Middleware authentication and membership verification still precede the first response. | This required security work remains a possible time-to-first-byte floor; it needs device/server timing evidence before further optimization. |
| P2 | The personalized program engine still reads broad health/history/assessment inputs. | Primary starter actions render independently, but the full personalized What’s Next still depends on those inputs. Follow-up narrowing requires tests for all recommendation and safety behavior. |
| P2 | Core read transports are not given a new global timeout or retry policy. | Slow optional schedule modules recover locally, while a stalled required personalization read may retain the starter shell. Avoid blanket retries or fabricated empty-data success. |

Targeted checks completed: TypeScript passed; lint of all startup files passed; 56 automated tests passed across PWA cache/update safety, hydration SQL retry and persistence, account ownership, request-identity access gates, schedule concurrency and stall recovery, calendar behavior, and local clock/resume refreshes. The root release worker owns the complete integrated test suite, production build, mobile/PWA acceptance and release decision. This document records implementation and its measured limits, not production deployment approval.

Integrated validation: 542 web tests passed with zero failures/skips; TypeScript, lint, and production build passed. Lint has existing warnings. Direct logging bypasses full program personalization and schedules after the existing identity/safety gates. Physical-device/browser/installed-PWA performance remains unmeasured. Read-only production SQL statement statistics and all release limitations are in `mobile-ux-pwa-release-2026-10-14.md`.
