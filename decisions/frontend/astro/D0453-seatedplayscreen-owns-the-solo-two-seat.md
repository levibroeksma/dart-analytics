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

# `SeatedPlayScreen` owns the solo/two-seat play-screen shell; tiles are written once as `Expr`s

## Context and Problem Statement
every tile was written three times per game and the shell was copied into nine files (#915), so layout changes had to land nine times and seat expressions drifted unseen.

## Decision Drivers
* Every tile is written three times per game, and the shell is copied into nine files (#915).
* Layout changes land nine times, and seat expressions drift unseen.
* Every seat expression is a mechanical expansion of the solo one: `fn()` becomes `fnFor(state()?.seats[i]?.participantRef)`.

## Considered Options
* Keep the nine interfaces with their copied shell and triple-written tiles.
* Extract `SeatedPlayScreen` with tiles written once as `Expr`s (chosen).

## Decision Outcome
Chosen option: "`components/layout/games/SeatedPlayScreen.astro` renders the wrapper, both `x-if` layouts (`SinglePlayerDisplay` / `SplitScoreboard`), `ErrorAlert`, the slotted input stack, `BoardInputPanel` and an optional `CountdownResumePrompt`. Values are `Expr`s (`src/lib/game/play-screen-expr.ts`): functions of a `Call` that yields `fn()` solo and `fnFor(state()?.seats[i]?.participantRef)` per seat, so each tile is written once. `c.solo` covers a solo expression with no `xFor` twin (Score Training's total). `idle` overrides the waiting seat's stat (Shanghai). Nine interfaces use it; Cricket and Tactics (solo-only, `MarkRows`) do not.", because every tile was written three times per game and the shell was copied into nine files (#915), so layout changes had to land nine times and seat expressions drifted unseen.

### Consequences
a new two-seat game's interface is a tile list and its input. The expression builders in `play-screen-expr.ts` run at build time inside the shell, and their `Call`/`Tile`/`Expr` types (`lib/game/interfaces.ts`, `types.ts`) are what all nine interfaces write against, so it is not a D101 test-only extraction; it is unit-tested. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built HTML of every game play route and `training/routines/play` before and after.

* Good, because a new two-seat game's interface is a tile list and its input.
* Neutral, because the expression builders in `play-screen-expr.ts` run at build time inside the shell. Their `Call`/`Tile`/`Expr` types are what all nine interfaces write against, so this is not a D101 test-only extraction, and it is unit-tested.
* Neutral, because `.astro` carries no unit test (D101). Proof was a byte-for-byte comparison of the built HTML of every game play route and `training/routines/play` before and after.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's parity method builds before and after and runs `diff -r` on every touched play route, which must be byte-identical. It adds unit tests for `play-screen-expr.ts`, which exists with a test file in `app/tests/lib/game/`.

## Pros and Cons of the Options
### Keep the nine interfaces
* Bad, because every layout change lands nine times.
* Bad, because the seat expressions can drift unseen.

### `SeatedPlayScreen` with `Expr`s
* Good, because each tile is written once, and the shell derives the solo and per-seat forms.
* Good, because the `solo` flag and `idle` override carry the exceptions (Score Training's total, Shanghai's idle stat) verbatim.
* Neutral, because Cricket and Tactics (solo-only, `MarkRows`) stay outside it.

## Evidence / More Information
Decided: 2026-10-13

* `docs/superpowers/specs/2026-10-13-play-screen-shells-design.md` (Evidence, Task B, Verification): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-10-13-play-screen-shells.md` (Task B decision step): rebuilt Consequences.
* Commit `87149432` (PR #950, 2026-10-13; adds the shell, `play-screen-expr.ts` with its test and the D453 row): confirmed Consequences and Confirmation.
