---
id: D0459
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Routine game steps put the pause pill in the header; a test pins the overlay containing block

## Context and Problem Statement
a routine step showed its timer in a different place from the same game played standalone (#846); D454 gave the routine header a play scope but the game step's own `x-data="game"` subtree cannot reach the header, and a second `x-data="game"` there would run the game store's `init()` twice. The containing-block rule was documented but unenforced, so a glass class on the panel root or a play wrapper would break magnifier tracking with the suite green (#847).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`/training/routines/play` renders one `CountdownPauseControl` in `GameLayout`'s `header-end` slot, beside `HeaderClockPill`, instead of one in a body row above each of its four game interfaces. The component gains an optional `scopeExpr`: when set, its play-scope reads go through `<scopeExpr>?.`, so the routine header reads the active game step as `game` and the pill hides while `game` is null; without it the markup is unchanged. `tests/components/layout/games/board-input-panel-containing-block.test.ts` walks every source ancestor of `BoardInputPanel`'s fixed ring and magnifier (inside the panel, each component and page that mounts it, each wrapping layout's `<slot>`) and fails on any class that sets `filter`, `backdrop-filter`, `transform`, or `will-change`/`contain` of them, deriving the banned `global.css` surfaces from their bodies.".

### Consequences
the body row above a routine game keeps only the step's `subtitle()` eyebrow. The 11 games' pages are unaffected (no `scopeExpr`). The scan checks `class`/`:class` string literals in source; a containing-block property set by `:style` or an element selector (e.g. `body`'s `transform-gpu`, which sits at the viewport origin) is outside it.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-13
