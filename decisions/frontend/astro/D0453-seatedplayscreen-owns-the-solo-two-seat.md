---
id: D0453
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, layout]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `SeatedPlayScreen` owns the solo/two-seat play-screen shell; tiles are written once as `Expr`s

## Context and Problem Statement
every tile was written three times per game and the shell was copied into nine files (#915), so layout changes had to land nine times and seat expressions drifted unseen.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`components/layout/games/SeatedPlayScreen.astro` renders the wrapper, both `x-if` layouts (`SinglePlayerDisplay` / `SplitScoreboard`), `ErrorAlert`, the slotted input stack, `BoardInputPanel` and an optional `CountdownResumePrompt`. Values are `Expr`s (`src/lib/game/play-screen-expr.ts`): functions of a `Call` that yields `fn()` solo and `fnFor(state()?.seats[i]?.participantRef)` per seat, so each tile is written once. `c.solo` covers a solo expression with no `xFor` twin (Score Training's total). `idle` overrides the waiting seat's stat (Shanghai). Nine interfaces use it; Cricket and Tactics (solo-only, `MarkRows`) do not.", because every tile was written three times per game and the shell was copied into nine files (#915), so layout changes had to land nine times and seat expressions drifted unseen.

### Consequences
a new two-seat game's interface is a tile list and its input. The expression builders in `play-screen-expr.ts` run at build time inside the shell, and their `Call`/`Tile`/`Expr` types (`lib/game/interfaces.ts`, `types.ts`) are what all nine interfaces write against, so it is not a D101 test-only extraction; it is unit-tested. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built HTML of every game play route and `training/routines/play` before and after.

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
