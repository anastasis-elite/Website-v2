# Homepage storytelling v1 — analytics and experiment notes

## Scope and baseline

Treatment branch: `codex/homepage-storytelling-v1`. Baseline source: `5d813d1d77305fa80ce9ac4387e29824de8bbf89`. The previous homepage remains retrievable in Git. The live public page was inspected before editing. Relevant instrumentation was inspected in `lib/posthog.ts`, `lib/analytics.ts`, `components/CookieBanner.tsx`, `components/TrackEvent.tsx`, `components/TrackedButton.tsx`, audit pages, and the AOS reporting event list.

This is a single **before-and-after treatment**, not a randomized A/B test. No assignment mechanism, feature flag, experiment rollout, remote dashboard, or remote PostHog setting was added. Baseline counts/results and uplift are unknown; no baseline outcome is fabricated.

Connected PostHog discovery was attempted, but no usable project or live-event result was obtained. Live event ingestion/availability and historical results remain unverified. The inventory below establishes availability in source, not verified production event volume.

## Event inventory

| Requested signal | Treatment event | Source availability and behavior |
| --- | --- | --- |
| Homepage view | Reuse `landing_page_viewed` | Previously emitted by homepage `TrackEvent`; replace that instance with the homepage-only observer. No redundant `homepage_viewed` event. Once per mounted homepage visit, including React StrictMode effect replay. |
| Story exposure | Add `homepage_story_section_viewed` | Once when at least 20% of the story heading is visible. A heading sentinel keeps the threshold reachable on short/mobile viewports. |
| Founder exposure | Add `homepage_founder_section_viewed` | Same heading exposure rule. |
| Community exposure | Add `homepage_community_section_viewed` | Same heading exposure rule. |
| Primary audit CTA | Reuse `audit_cta_clicked_1`, `audit_cta_clicked_2`, `audit_cta_clicked_3` | Preserve the original event names and `location` values `hero`, `outcome`, `final_cta`. No redundant `homepage_primary_cta_clicked` event. One capture per browser click. |
| Program navigation | Add `homepage_program_cta_clicked` | Same-origin `/program` and `/program/ember`, `/program/ignite`, `/program/phoenix` links while homepage is mounted; includes header/footer. Stable locations distinguish `features`, `final_cta`, `navigation`, `footer`, and fallback `programs`. Query strings, full URLs, and link text are not collected. |
| Capacity Audit entry/start proxy | Existing `audit_page_viewed` | `app/audit/page.tsx` emits on audit entry. This is an entry proxy, not a verified first-answer action; its existing TrackEvent does not guard StrictMode replay. Deduplicate by session for analysis. No audit code changed. |
| Capacity Audit completion | Existing `audit_page_completed` | `app/audit/page.tsx` captures after successful audit persistence. Use the existing event name for completion counts. No audit code changed. |
| Audit results | Existing `audit_results_viewed` | Results page tracks the result view. Not equivalent to successful submission by itself. |
| Program view | Existing `program_viewed` | Program detail pages emit this event. |
| Checkout start | No active emitter found | `checkout_started` is only named in the consulted AOS reporting inventory; no capture call found in commerce routes/components. Source availability cannot establish a usable conversion event. |
| Purchase | No active emitter found | `checkout_completed` likewise appears in reporting configuration without a capture emitter. No reliable purchase event was found in consulted code. Payment functionality was not modified to fill this gap. |

## Properties and privacy

Every explicit homepage event passes through the existing `trackEvent` helper/sanitizer and carries only fixed marketing properties:

- `page: 'landing'`
- `experiment_id: 'homepage_storytelling_v1'`
- `homepage_version: 'storytelling_v1'`
- `location` and `cta_location` on clicks, preserving the existing audit locations
- `program: 'all' | 'ember' | 'ignite' | 'phoenix'` on program clicks
- Existing helper timestamp and normal SDK-generated event/session metadata

No questionnaire answers, scores, health context, form values, member identifiers, user names, emails, private URLs, or free-text content are read or added by this implementation. It does not register global super-properties or attach treatment properties to unrelated routes. Attribute downstream events to a prior treatment exposure through existing anonymous session continuity; filtering every funnel step by `experiment_id` would incorrectly discard existing downstream events, which do not carry that property.

The unchanged existing audit-completion payload includes `capacity_score`, `recommended_program`, and `audit_id`; do not export those properties or use them as marketing breakdowns. Count the completion event only. Review that pre-existing downstream payload separately before broader marketing reuse; it remains outside this homepage-only diff.

## Consent and duplicate control

Explicit homepage events require `cookie_consent === 'accepted'`, honoring the existing consent choice. Unknown, declined, and inaccessible storage fail closed. Same-tab acceptance is read after the existing CookieBanner handler; cross-tab changes use the storage event. Only currently visible headings are released after consent. No pre-consent interactions are retrospectively recorded.

A WeakMap keyed by the actual homepage main element deduplicates page/heading exposures across StrictMode effect replay while allowing a fresh navigation to count. A WeakSet prevents the same browser click from being captured twice. Intersection observers and document/storage listeners disconnect on unmount.

**Existing limitation:** the shared deferred PostHog initializer still enables automatic `$pageview`/`$pageleave` outside CookieBanner gating. The banner originally gates Google Analytics only. No global analytics/consent behavior was changed. Baseline explicit homepage events also lacked consent gating. Historical baseline exposure denominators therefore may not be comparable with the consented treatment denominator. Do not interpret a lower raw event count as lower conversion. A compatible consented baseline is needed for a trustworthy before/after rate comparison; this implementation does not reconstruct one from unknown historical data.

## Measurement definitions

Use the same project timezone, bot/internal-traffic exclusions, traffic-source mix, device breakdown, consent eligibility, and equal observation windows for baseline/treatment. Fix these choices before reading outcomes. Count unique eligible sessions, not raw event totals; each numerator must follow the homepage exposure within that session. These are proposed readout definitions, not calculated results:

| Metric | Numerator | Denominator | Current status |
| --- | --- | --- | --- |
| Homepage primary CTA click-through rate | Eligible homepage sessions with any of `audit_cta_clicked_1/2/3` | Eligible homepage sessions with `landing_page_viewed` | Treatment implemented; compatible historical baseline unverified. |
| Program CTA click-through rate (secondary) | Eligible homepage sessions with `homepage_program_cta_clicked` | Eligible homepage sessions with `landing_page_viewed` | Treatment implemented; baseline has no equivalent explicit signal. |
| Capacity Audit start rate | Exposed homepage sessions followed by `audit_page_viewed` | Eligible homepage sessions with `landing_page_viewed` | Available in source as an entry/start proxy; live ingestion and baseline comparability unverified. |
| Capacity Audit completion rate | Exposed homepage sessions followed by `audit_page_completed` | Eligible homepage sessions with `landing_page_viewed` | Available in source; no live result asserted. Also report completed / entered as a separate audit step-completion rate. |
| Checkout start rate | Exposed homepage sessions followed by a verified checkout-start event | Eligible homepage sessions with `landing_page_viewed` | Unavailable until an operational downstream event is confirmed or separately implemented. |
| Purchase conversion rate | Exposed homepage sessions followed by a verified successful-purchase event | Eligible homepage sessions with `landing_page_viewed` | Unavailable until operational purchase telemetry is confirmed or separately implemented. |

A separate seven-day visitor-conversion metric can capture later returns if anonymous continuity and a verified purchase event support it. Do not mix that attribution window with the session-based rates above or join using collected identity/health data. Section exposure events are diagnostic reach signals, not conversion denominators selected after the fact.

## Validation and limits

Focused runtime tests cover consent, StrictMode, repeated intersections, section sentinels, click deduplication, stable CTA locations, safe allowlisted properties, and cleanup. Real browser QA verifies page/navigation/image behavior with PostHog disabled and external traffic blocked. No live ingestion, downstream audit submission, checkout, or purchase was triggered. No baseline results, statistical significance, randomized assignment, or conversion improvement is claimed.
