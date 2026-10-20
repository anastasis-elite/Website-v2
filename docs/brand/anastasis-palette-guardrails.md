# Anastasis palette guardrails

Founder handoff, 2026-10-20. This policy applies to every Anastasis web page, PWA, app and admin surface, and to applicable backend-generated UI, email and content. Backend behavior remains subject to existing philosophy, formula and privacy rules. Soma Rhea is future separate work after PHOENIX completion; this change does not rename or switch Anastasis.

| Shared token | Exact value |
|---|---|
| --anastasis-black | #0C0C0C |
| --anastasis-charcoal | #2B2B2B |
| --anastasis-ivory | #F5F1E8 |
| --anastasis-copper | #B87333 |
| --anastasis-flame | #FF6B3C |
| --anastasis-red | #B63A28 |

The web token source is `app/styles/anastasis-palette.css`. Every tier uses the same values. Main backgrounds and navigation are black; cards and panels are charcoal; primary copy is ivory. Primary buttons may use the supplied copper button gradient with ivory text, or solid flame with black text for optional emphasis. Secondary buttons are transparent, with a copper border and ivory copy on dark surfaces. Explicit light sections are ivory with black copy, including their secondary controls. Charcoal cards placed in a light section still explicitly use ivory copy.

The later founder handoff permits supplied warm copper-brown supporting shades. Keep black and warm obsidian as foundations; do not create a wholesale brown theme or add unrelated decorative colors. Completion, warnings and errors need visible text and icons, never color alone. Red is a brand color, not an automatic error mapping.

The signature gradient is exactly `linear-gradient(135deg, #B87333 0%, #FF6B3C 55%, #B63A28 100%)`. Use it sparingly for decorative flame art, selected borders or highlights; never for paragraph text. The separate supplied copper button gradient is permitted on primary buttons. A selected gradient border also needs a solid, high-contrast indicator if it conveys essential state. Functional two-token progress arcs/filled tracks and unknown-data patterns are data encodings, not alternative signature gradients.

Opaque contrast: ivory/black 17.35:1; ivory/charcoal 12.56:1; black/flame 6.91:1; black/ivory 17.35:1. Copper/charcoal is 3.73:1 and copper/ivory 3.36:1, suitable for boundaries but insufficient for small normal copy. Red/charcoal is 2.44:1 and must not carry essential UI meaning there. An offset solid copper focus ring works against black, charcoal and ivory; a light section can use black. Keep focus visible across all input methods and retain explicit labels/icons for statuses.

## Bounded implementation and remaining coverage

This first implementation aligns the shared web token aliases, shared inline style objects and global stylesheet paints, plus the preserved dashboard/card/progress/calendar preview presentation. It preserves layout and behavior, and does not touch task 1's workout candidate. The dashboard and calendar are separate local branches with different prerequisite commits; their base integration is not accepted by this palette change. The previously delivered preview video predates this alignment.

Token adoption does not establish whole-app coverage. A source inventory of the dashboard base, excluding updated shared/proposal files, found 63 web files with paint literals: 17 routes/layouts, 32 component/style files and 14 AOS/admin files. These heuristic counts are not counts of defects or contrast failures. Representative remaining areas:

- Public web: `app/page.tsx` inline styles, landing sections and commerce/customer UI.
- Member UI: `components/CycleFlowLogger.tsx`, CookieBanner, navigation CSS and other local inline styles. Calendar module alignment is carried by the separate calendar branch; the dashboard branch alone does not include it.
- Workout: task 1's separately frozen/manual component stylesheet and any later workout edits need integration against these tokens; they were not overwritten here.
- Admin/AOS: `components/AOSNavigation.tsx`, analytics chart paints, QA tables and gift-client forms.
- PWA: `app/manifest.ts`, root `app/layout.tsx` theme metadata, Git-tracked `public/offline.html`, install/splash/icon assets.
- Native: Git source inventory found paint literals in 24 of 46 mobile JS/TS files. `anastasis-mobile/lib/theme.ts`, BottomNav, AOSButton, Today, MacroProgressBar and Expo configuration have independent palettes.
- Backend-generated content: `lib/commerce/invitationDelivery.ts` and gift-client HTML, plus any HTML supplied through the generic email dispatcher. Plain-text messages have no color styling to align. No message was sent or account created for this inventory.
- Four native PNGs and four PWA icon filenames were identified but their binary artwork was not inspected. No built or distributed native application was verified.

These are coverage notes for the existing parent ledger, not a new competing backlog. Remaining surfaces require semantic review, accessible statuses/charts and synthetic verification; blind replacement cannot verify them. No deployment, production write, formula change, migration, installation or additional spend is authorized by this document.

## Superseding supporting palette handoff

The later October 20 founder handoff adds Warm Obsidian #15110E, Smoked Copper #281C14, Muted Stone #B8ADA0, Deep Copper #583523, Rich Copper #885333 and Copper Highlight #D99A5E. The original six values remain unchanged. Black/warm obsidian are foundations; charcoal panels and ivory headings remain. Muted stone supports copy only on verified dark backgrounds. Smoked copper is restrained logo glow, not a page-wide surface. PHOENIX orange/red emphasis is optional, not mandatory on every screen.

Button gradient: `linear-gradient(180deg, #885333 0%, #583523 100%)` with ivory text. Metallic gradient: `linear-gradient(135deg, #885333 0%, #D99A5E 48%, #B87333 72%, #583523 100%)`, reserved for decorative artwork/highlights. No text or essential state relies on the metallic gradient. Supporting shades/gradients stay within the supplied palettes; completion/issues still use labels plus icons. An explicit light section keeps black text.

The founder selected these hex values visually, not by extraction from source imagery. This revision does not claim screenshot/color matching, full-app verification, a theme rename or Soma Rhea activation. Global remaining-surface inventory and release gates above remain in effect.

Source contrast check (opaque colors, 10,001 sRGB samples per gradient): ivory over the full copper button gradient is at least 5.59:1. Black and muted stone fail on that gradient. Muted stone passes on black (8.87:1), charcoal (6.42:1), warm obsidian (8.51:1) and smoked copper (7.52:1), but fails on rich copper (2.86:1) and ivory (1.96:1). Generic shared inline copy stays ivory; the inline primary-button export keeps flame/black because existing schedule weekday selection depends on that stronger contrast. Copper-gradient shared CSS and known primary preview controls are opt-in; the opt-in supporting-copy utility switches to black inside explicit light sections. Metallic gradient has no text color with reliable normal-copy contrast; keep it decorative. Solid copper focus uses a 3px offset on a verified black/charcoal/warm foundation, or black on ivory; copper directly against rich/deep copper is insufficient. Do not place essential controls on those supporting fills without a separately verified boundary/focus treatment. These calculations do not replace rendered keyboard, hover, disabled, mobile or device verification.
