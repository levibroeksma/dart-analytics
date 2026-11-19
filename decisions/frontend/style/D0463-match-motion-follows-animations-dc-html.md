---
id: D0463
status: accepted
date: 2026-10-16
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, motion]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Match motion follows Animations.dc.html; tokens live in `global.css`

## Context and Problem Statement
the user corrected the brand guide's `animate-deck-*` values (240/220ms keyframes) as a mistake; the studies' slot moves and shared-element glides need transitions and FLIP, which keyframe tokens cannot express in a responsive layout.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the Claude Design `Animations.dc.html` studies are the motion source of truth. The resume deck shows up to three real cards and steps through `go → snap → back → idle` on timers (`deckSlots()`, `deck-*` utilities: out 440ms, rise 460ms +60ms, return 500ms), past three cards the hidden fourth enters the back slot, and `prev` is the exact reverse. The 1v1 turn switch keeps seat order and morphs with `seatMorph()` (FLIP: card heights and the name/score twins animate 500ms `cubic-bezier(0.65,0,0.35,1)`, layers cross-fade via `seat-layer-in/out`). Dartbot darts aim, fly from below the board, stick and ripple (`animate-reticle-aim`, `-dart-fly`, `-dart-stick`, `-dart-ripple`); off the visual board a `BotBoardPanel` stands in for the input stack while it throws. A falling seat score counts down over 700ms (`scoreTween`). The starter step uses `coin-*`, `bull-ring*` and `starter-win*` utilities. Every motion has a reduced-motion path.".

### Consequences
`CardStack.astro` and the `stack-slab-*` utilities/colours are removed. `SplitScoreboardHalf` lays out panel and bar at once; the active seat no longer moves to the top (seat A, the starter, stays on top all match). Motion values are pinned by `tests/lib/ui/brand-tokens.test.ts`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-16
Supersedes: D442 in part (deck animation and slab stack only).
