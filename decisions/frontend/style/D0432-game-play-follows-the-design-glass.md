---
id: D0432
status: accepted
date: 2026-10-08
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, glass, surface]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Game play follows the design: glass header, stacked seats, inset keys

## Context and Problem Statement
one restyle of shared shells and inputs reaches all 11 games; values from data keep the design's sample numbers out of the app.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every `/games/*/play` screen follows Claude Design `Game Play Recreational.dc.html` / `Game Play Analytics.dc.html`, in place in the shared shells so all 11 games inherit it. `GameLayout` is a 56px `glass` header pill (exit, display title, live `gameSubtitleExpr`, `header-end` slot); each play page mounts its `x-data` on `<GameLayout>` so header expressions resolve in the play scope. Solo: a `glass` card with the big value sized by length (`bigValueSize`, `seatValueSize`: one container-query clamp class per length step, each capped at the design size — 84 / 64 / 46px — so no length overflows a 375px column) and up to three `PlayStatTile`s or `MarkRows`. Multi-seat (every game with a second seat): the throwing seat's `glass-active-seat` card above the waiting seat's 64px row, with `LegBars` — one bar per leg to win up to 5, a `won/target` counter above. Keys are `InputButton`s with the `key-press` accent ring instead of a scale; panels sit in `input-well`; the visit strip rings the next dart. Analytics mode keeps the board alone, no keypad (D201); the existing SVG board dims while pressed; the magnifier keeps its placement (D199) and shows its read in a pill inside the circle. `BoardInputPanel`'s root carries no surface — its glass is an `aria-hidden` absolute background layer — because a `backdrop-filter` ancestor would become the containing block for the `fixed` magnifier and press ring. Cricket/Tactics get an S key that clears D/T — no new ring state; Tactics' 14…1 stay available once D/T is armed. The timer is a `CountdownPauseControl` pill in `GameLayout`'s `header-end` slot on the four countdown games; routine play, whose header has no play scope, renders its own above each of its four game interfaces, beside the step's `subtitle()` as a mono eyebrow. While paused the pill stays visible with the remaining time, disabled; resuming keeps `CountdownResumePrompt`. The header subtitle renders only while `hasActiveSession`, and an unknown stored order mode reads blank. 121 and TUOD subtitles name the ROUNDS budget (`ATTEMPT n OF N`, capped at N). Every subtitle and stat comes from engine or config data via a tested `subtitle()` per factory, in the setup wording (`ORDER_MODE_LABELS` now shared from `lib/game/play-subtitle.ts`). Training screens inherit only through the shared parts.", because one restyle of shared shells and inputs reaches all 11 games; values from data keep the design's sample numbers out of the app.

### Consequences
`magnifierLabelStyle`, `magnifierLabel` and `MAGNIFIER_LABEL_GAP` are removed with their tests; the play getters left without a caller are removed with their tests — `matchTitle` (501), `hitsNeededLabel` (Around the Clock, replaced by `hitsToGo`), and `attemptLabel`, `durationType` and `dartsThrownThisSession` (121); `SplitScoreboardHalf`'s legs badge and dot pager are removed; `SinglePlayerDisplay` drops `label`, `size`, `fluid`, `activeExpr` and `pinnedHeight` (gains `caption` and a `route` slot). `.astro` carries no unit test (D101); helpers in `lib/ui/play-display.ts` and `lib/game/play-subtitle.ts` and every new getter are tested; CSS is pinned in `brand-tokens.test.ts`. Deferred (GitHub issues): paused-state design, results modals, training-screen gaps, no test pins the rule that no filter/backdrop/transform ancestor may sit above the fixed magnifier; stale Style Guide keypad line (#837).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-08
Supersedes: D204 (read placement only — now inside the circle); D262 (`fluid` replaced by `bigValueSize`); D327 (`pinnedHeight` clause only — the prop is removed, the shells still own the band).
Referenced by D0436's `Supersedes:` line.
