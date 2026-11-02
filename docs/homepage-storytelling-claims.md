# Homepage storytelling claim review

Review basis: repository commit `5d813d1d77305fa80ce9ac4387e29824de8bbf89` (baseline), 29 October 2026. This is a targeted source review for homepage copy, not a live member-account acceptance test. No member data, schemas, entitlements, or purchase logic were changed by this review.

## Product statements

| Homepage statement | Source evidence | Boundary |
| --- | --- | --- |
| Training: assessed plan, exercise guidance, recorded workouts | `app/api/program/generate/route.ts:45` loads initial and strength assessments; `:66` requires the strength assessment; `:100` generates and saves the plan. `lib/program/generateProgram.ts:103` resolves recorded equipment, `:258` reads assessed lifts, and `:299` returns prescribed exercise/load data. `components/workout-dashboard/WorkoutDashboard.tsx:105`, `:270`, and `:176` expose workout guidance, tracking, and saved history. `app/api/workout-log/route.ts:35` persists the recorded workout. | A starting plan depends on completing member setup and assessments. Do not imply that the public Capacity Audit creates a training plan or that a new visitor already has one. The good-morning story represents an enrolled, set-up member. |
| Nutrition: targets and food tools appropriate to the program | `lib/nutrition/targetEngine.ts:343` calculates nutrition targets. `app/dashboard/nutrition/page.tsx:43` loads the shared program logic; `:54` renders the nutrition dashboard. `lib/entitlements.ts:54`–`:149` defines tier availability, and `lib/nutrition/memberNutrition.ts:39`–`:77` limits Ember responses to macro/water totals. | Ember has calorie/macronutrient targets, manual daily macro totals, and water tracking; it does not include food/meal or barcode logging or micronutrient guidance. Ignite and Phoenix have meal/manual-food and barcode tools. Avoid a blanket claim that all tiers include meal logging. |
| Recovery: guidance informed by recorded context | `app/dashboard/recovery/page.tsx:26` loads program logic; `:31`–`:51` reads the member's recovery logs and saved recovery activity. `lib/dashboard/logic/getProgramLogicEngine.ts:392`–`:437` derives the recovery/workout context; `components/recovery/RecoveryDashboardClient.tsx:249` and `:319` display priority and recovery actions. | Recorded inputs and missing-input states affect guidance. No guarantee that the system knows a member needs recovery without a check-in or other available context. The requested recovery-evening story describes a member's choice and supported guidance. |
| Progress: a history of work and recorded changes | `app/dashboard/progress/page.tsx:12` loads the progress overview; `lib/dashboard/progressOverview.ts:39`–`:78` builds histories from recorded workout loads, measurements, and recovery energy; `:91` reads member history. | Describe saved records, not guaranteed health outcomes. Missing history is represented as empty or unavailable. |
| Disrupted afternoon: check in, review options, decide what fits | `components/recovery/RecoveryDashboardClient.tsx:142` provides a check-in/actions view; `components/DailyCheckInForm.tsx` records the check-in; `components/DailyPlanCard.tsx:13` links the available next action; `lib/workout/getWorkoutForToday.ts` distinguishes planned, reduced, recovery, and starter workouts. | Supported as a member reviewing guidance and making a choice. Do not add claims of autonomous rescheduling, live coach intervention, or automatic reconstruction of a routine. |

## Homepage program summaries

- **Ember — “A foundation you don’t have to build from scratch.”** Supported when paired with assessed training, macro targets/daily totals, water tracking, basic recovery guidance, and recorded progress. Sources: `lib/entitlements.ts:54`, `app/program/ember/page.tsx:5` and the implementation evidence above.
- **Ignite — “Understand more. Refine what works.”** Supported when paired with manual food/barcode logging, nutrient detail from recorded foods, recovery recommendations, and progress history. Sources: `lib/entitlements.ts:85`, `app/program/ignite/page.tsx:37`, `components/NutritionFoodLogger.tsx:138`.
- **Phoenix — “Less figuring out. More directed support.”** Use “directed” to mean suggested nutrition/recovery next actions, not staffed or clinical support. `lib/entitlements.ts:117` enables recommended meals and directed recovery. `lib/nutrition/recipes/getPhoenixRecipeRecommendations.ts:15` selects recipes from recorded nutrition/energy context. `app/program/phoenix/page.tsx:77` describes suggested nutrition or recovery action.
- **Do not add meal-photo estimation:** although the Phoenix capability flag is true, `app/api/nutrition/photo-estimate/route.ts:52` returns `configured: false` with HTTP 501, and its GET returns `available: false`. The UI labels it unavailable (`components/NutritionFoodLogger.tsx:183`).

## Community

The in-app community is a fictional, local-interaction preview. `app/dashboard/community/components/CommunityFeed.tsx:84` explicitly says posting is unavailable and support/replies are not saved or shared. `:120` says following, saved posts, and media sharing are unavailable. No operational community publishing service or first-of-month participation mechanism was found in this targeted review.

The requested copy is acceptable as a **community vision** only, with a clear adjacent note that in-app posting and photo sharing are not yet available. Monthly updates may be invited as a future community practice, with optional photos/stories; do not imply submission, publishing, or scheduled notifications work now. Do not reuse the fictional names/counts as social proof.

## Founder assets and attribution

No approved authentic founder portrait was identified. The public raster assets at baseline are logos/icons, a body-map silhouette (`public/woman-silhouette.png`), and the guide artwork (`public/AA8E8B4D-7C51-42CC-9C18-6B53F085A673.png`, used as “The Anastasis Shift” at `app/guide/page.tsx:38`). None is established as a founder photo. Leave a clean founder image slot; do not generate a likeness.

The user supplied the new founder story, full name, and NASM attribution. Existing `app/what-is-anastasis/page.tsx:123` lists Certified Personal Trainer and Certified Nutrition Coach; it does not independently establish the full name or certifying organization. Publish the supplied copy as instructed, and flag the exact credential attribution for founder review before release.

## Verification limits

This review establishes that the requested restrained product descriptions have matching implementation paths. It does not prove current provider/database operation, every member's setup, food-catalog/barcode coverage, individual recommendations, or human support availability. No protected member flow was exercised and no claim was expanded to automation, integrations, clinical outcomes, staffing, community availability, or guaranteed results.
