# Homepage storytelling v1 — review packet

## Change and baseline

Branch: `codex/homepage-storytelling-v1`. Baseline: `5d813d1d77305fa80ce9ac4387e29824de8bbf89` (`origin/main` when implementation began). Retrieve the previous homepage with `git show 5d813d1:app/page.tsx`.

The treatment preserves the existing hero headline, logo, fonts, charcoal/bone/copper colors, spacing values, cards, navigation, Capacity Audit destination, and closing purchase exploration route. It adds the requested hero supporting copy, evening story directly after the hero, three everyday scenarios within How It Works, the four concrete product descriptions, founder narrative, community vision, and closing message. Existing Capacity Audit and Who It Is For sections remain. Repetitive explanation sections become the requested scenario/product sections using the existing styles. The baseline has no individual program summaries on the homepage; no pricing, entitlements, or program-page copy was changed.

All application changes are confined to the homepage and new homepage-only style/analytics files. Authentication, onboarding, audit implementation, checkout, subscriptions, shared components, dashboards, and database schemas remain outside the diff. The original dirty checkout remains untouched.

## Images

- Added `public/images/homepage/evening-kitchen.webp`: generated fictional editorial lifestyle scene, 1536×1024, 100,276 bytes. Generation used the built-in ImageGen capability. No external service or dependency added. Original generation is retained in the local ImageGen output directory.
- Next Image serves responsive sizes, preserves the 3:2 aspect ratio, reserves dimensions, and lazy-loads the below-the-fold story image. The existing hero logo retains priority loading.
- Founder: clean portrait placeholder, visibly labeled “Photograph to come.” No approved authentic photograph was found; no synthetic founder likeness generated.
- No app screenshot added: the story and restrained product descriptions stand on their own, avoiding synthetic product UI or private member content.

## Measurement

See [analytics inventory and metric definitions](homepage-storytelling-analytics.md). Identifier: `homepage_storytelling_v1`; homepage version: `storytelling_v1`. This is one before-and-after treatment with no randomized assignment and no A/B-test claim. No baseline result or conversion uplift is asserted.

## Targeted validation

- Homepage-scoped TypeScript check passed (page, analytics component/helper and their imports; no repository-wide typecheck).
- ESLint passed for the modified TS/TSX files.
- Eight focused analytics runtime tests passed: accepted/declined consent, same/cross-tab changes, StrictMode replay, section deduplication, audit clicks, program clicks, cleanup, and fixed safe properties.
- Browser checks passed at 1440×1000, 390×844, and 320×740: no JavaScript page errors; no horizontal overflow including descendants; all three audit CTAs reached `/audit`; How It Works anchor reached its section; navigation opened and Programs reached `/program`; closing Compare Support Levels reached `/program`.
- Story image decoded successfully at every viewport, used responsive Next Image URLs, retained its ratio, and reported `loading=lazy`.
- Reduced-motion rendering exposes the existing animated headline/logo immediately, through homepage-scoped overrides. No new animation or autoplay media added.
- Desktop/mobile screenshots were visually inspected for story layout, image sizing, readable text, founder slot, and retained hero styling. [Browser results](screenshots/homepage-storytelling/results.json) and screenshots are saved beside this packet.
- Diff whitespace check passed. No repetitive repository-wide checks run.

QA runs with placeholder public auth configuration, no PostHog key, and browser network traffic restricted to localhost. Protected member functions, audit submission, payment actions, live PostHog ingestion, actual mobile hardware, full performance profiling, and production behavior were not exercised. Navigation checks do not represent completed audit or purchase journeys.

To repeat browser QA, start the local Next dev server on port 3100 with analytics disabled, then run `node scripts/verify-homepage-storytelling.cjs`. Use `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` to point to existing installed tooling if necessary; no package installation is required by this change.

## Claim review and release review items

See [source evidence and limitations](homepage-storytelling-claims.md). Product statements have implementation evidence; live member-account operation was not exercised. A ready training plan presumes completed member setup/assessments. Food tools vary by program. No automated rescheduling, meal-photo estimation, human concierge staffing, or live community publishing is claimed.

The founder story and exact NASM attribution are supplied by the user; the repository independently establishes CPT/CNC only. Confirm the exact name/certifying organization and provide an approved portrait before release. The first-of-month community language expresses a vision and personal update invitation; no operational community submission mechanism is promised. Posting/photo sharing is explicitly marked unavailable.

Local visual preview: http://127.0.0.1:3100. Implementation stops at review preparation. No production deployment or merge has been performed.

## File manifest

- `app/page.tsx`
- `app/homepage.module.css`
- `components/homepage/HomepageAnalytics.tsx`
- `lib/analytics/homepageStorytelling.ts`
- `public/images/homepage/evening-kitchen.webp`
- `tests/homepageStorytellingAnalytics.test.mjs`
- `scripts/verify-homepage-storytelling.cjs`
- `docs/homepage-storytelling-review.md`
- `docs/homepage-storytelling-analytics.md`
- `docs/homepage-storytelling-claims.md`
- `docs/screenshots/homepage-storytelling/results.json`
- `docs/screenshots/homepage-storytelling/desktop-hero.png`
- `docs/screenshots/homepage-storytelling/desktop-story.png`
- `docs/screenshots/homepage-storytelling/desktop-founder.png`
- `docs/screenshots/homepage-storytelling/desktop-community.png`
- `docs/screenshots/homepage-storytelling/mobile-hero.png`
- `docs/screenshots/homepage-storytelling/mobile-story.png`
- `docs/screenshots/homepage-storytelling/mobile-founder.png`
- `docs/screenshots/homepage-storytelling/mobile-community.png`
- `docs/screenshots/homepage-storytelling/narrow-mobile-hero.png`
- `docs/screenshots/homepage-storytelling/narrow-mobile-story.png`
- `docs/screenshots/homepage-storytelling/narrow-mobile-founder.png`
- `docs/screenshots/homepage-storytelling/narrow-mobile-community.png`
