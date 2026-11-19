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

# Match motion follows Animations.dc.html; tokens live in `global.css`

## Context and Problem Statement
the user corrected the brand guide's `animate-deck-*` values (240/220ms keyframes) as a mistake; the studies' slot moves and shared-element glides need transitions and FLIP, which keyframe tokens cannot express in a responsive layout.

## Decision Drivers
* Explain a state change with motion and never decorate (spec, Intent).
* Take every timing and easing from a named token in `app/src/styles/global.css` `@theme`, with no raw durations in components (spec, Goals).
* Give every animation a reduced-motion path (spec, Goals).
* The user corrected the brand guide's deck values to the study's timings (spec, Motion tokens).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "the Claude Design `Animations.dc.html` studies are the motion source of truth. The resume deck shows up to three real cards and steps through `go → snap → back → idle` on timers (`deckSlots()`, `deck-*` utilities: out 440ms, rise 460ms +60ms, return 500ms), past three cards the hidden fourth enters the back slot, and `prev` is the exact reverse. The 1v1 turn switch keeps seat order and morphs with `seatMorph()` (FLIP: card heights and the name/score twins animate 500ms `cubic-bezier(0.65,0,0.35,1)`, layers cross-fade via `seat-layer-in/out`). Dartbot darts aim, fly from below the board, stick and ripple (`animate-reticle-aim`, `-dart-fly`, `-dart-stick`, `-dart-ripple`); off the visual board a `BotBoardPanel` stands in for the input stack while it throws. A falling seat score counts down over 700ms (`scoreTween`). The starter step uses `coin-*`, `bull-ring*` and `starter-win*` utilities. Every motion has a reduced-motion path.".

### Consequences
`CardStack.astro` and the `stack-slab-*` utilities/colours are removed. `SplitScoreboardHalf` lays out panel and bar at once; the active seat no longer moves to the top (seat A, the starter, stays on top all match). Motion values are pinned by `tests/lib/ui/brand-tokens.test.ts`.

* Neutral, because the spec adds a `deck-return` token and a turn-switch token, which the study needs and brand guide § 06.1 lacks (spec, Calls I made).
* Neutral, because decks over three show 3 cards and the hidden fourth enters the back slot (spec, Part 1 and Calls I made).
* Neutral, because the spec marks the new-token and fourth-card choices as calls not confirmed by the user (spec, Calls I made).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/ui/brand-tokens.test.ts` pins the motion utilities, for example `seat-layer-out` and `seat-layer-in`, and runs with the test suite. Spec § Constraints says the animations themselves are verified in the running app.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-16
Supersedes: D442 in part (deck animation and slab stack only).

* Commit `a712563d` (2026-10-17; adds D463 and D464, plus the plan): origin of the existing Context, Decision Outcome and Consequences text. It rebuilt no section here.
* `docs/superpowers/specs/2026-10-16-match-motion-and-starter-design.md` (Intent, Goals, Motion tokens, Part 1, Constraints, Calls I made): rebuilt Decision Drivers, Consequences and Confirmation.
