# Nutrition page cleanup verification

Base: `d76212bc50f7bb5d74bbd1d7e4808a441d7bd947`

## Result

- The four existing daily progress circles now appear inside Your daily targets, showing logged calories, protein, carbohydrates and fat against their saved targets. The existing confirmed-meal plus manual-macro calculation remains authoritative. Missing values remain unavailable; over-target amounts remain visible while ring fills stop at 100%.
- Removed the redundant nutrition objective/targets panel, separate daily progress/trends panel and Goals / Assessment content. Trends remain in Progress.
- Ember's two guidance cards are whole-card Add Macros and Log Water buttons. Water uses the existing hydration dialog. The macro dialog uses the existing form values and additive save endpoint, with native dialog keyboard behavior, input labels and loading/unavailable status.
- Macro saves use a synchronous submission lock and a browser marker before sending. Unconfirmed outcomes block blind resubmission across reopening/reloading. A read-only totals check and explicit separate-entry action are required to proceed after uncertainty. Confirmed saves clear the form and remain reported as saved if refreshing totals fails. The endpoint remains additive and has no server idempotency guarantee.
- Ember no longer renders or fetches Suggested Foods; its obsolete saved Suggested Foods selection is retired. Ignite/Phoenix keep food logging, suggested foods, micronutrients and their existing recipe entitlement.
- Hydration persistence, member authorization, navigation, records and branding remain in place. No database, API, authentication, dependency or allergy/report feature changes.

## Focused automated checks

82 tests passed:

```sh
node --test tests/nutritionCleanup.test.mjs tests/nutritionDashboardLayout.test.mjs tests/nutritionDirectEntry.test.mjs tests/nutritionDailyPersistence.test.mjs tests/nutritionMicronutrientMemberUI.test.mjs tests/nutritionRecoveryStability.test.mjs tests/nutritionResume.test.mjs
```

Coverage includes saved totals, zero/missing/over-target rings, newly refreshed targets with unavailable totals, removal of duplicate sections, retired Ember preferences and background requests, downgrade protection, preserved higher-tier tools, modal labels/focus/close, double submission, uncertain saves across remount, pre-write rejection, degraded successful saves and successful writes followed by refresh failure.

31 additional focused checks passed:

```sh
node --test tests/hydrationSubmission.test.mjs tests/hydrationMembershipBoundary.test.mjs tests/suggestedFoodsPortions.test.mjs
```

TypeScript passed with `node_modules/.bin/tsc --noEmit --incremental false`. Focused ESLint reported zero errors and four `@next/next/no-img-element` warnings for reused illustration markup. `git diff --check` passed.

## Browser checks

Eight checks passed using a temporary local fixture with actual updated dashboard/dialog components, real React and mocked transport. Headless Chromium reported zero page errors:

1. At 390px: four combined rings, correct logged/target amounts and Ember card controls; no horizontal overflow.
2. Native macro dialog name, initial input focus, Tab containment, Escape close and return focus to its card.
3. Rapid macro submits generate one POST; success clears inputs and updates the rings.
4. The water card opens the existing dialog; saving updates the displayed total.
5. A confirmed macro save followed by totals refresh failure stays reported as saved, with blank inputs.
6. An uncertain macro save survives close/reload and blocks a blind second write.
7. At 320px: rings, cards and macro dialog fit without horizontal overflow.
8. At 1280px: all four rings appear in one row and cards fit.

These are synthetic data/API checks. Live authenticated saves, physical iOS/Android devices, mobile Safari, assistive technology and a full production build were not exercised. No publication or deployment occurred.

## Existing failures and limitation

The separate `hydrationTarget.test.mjs` suite has seven failures (403 responses where success/day-conflict responses are expected). The isolated `nutritionIntelligenceEntitlement.test.mjs` suite has three failures (403 responses where 200 is expected). Each failure was reproduced in an untouched local worktree at the base SHA above. Their API/auth implementation and fixtures were not changed by this cleanup.

Historical nutrition trends still omit manual macro entries: `buildTrends` in `lib/dashboard/logic/getProgramLogicEngine.ts` aggregates meal totals for historical calories/protein. This cleanup does not change that engine or claim that moving/removing UI corrects historical trends. Current-day combined rings continue to include confirmed meals and manual macro entries.
