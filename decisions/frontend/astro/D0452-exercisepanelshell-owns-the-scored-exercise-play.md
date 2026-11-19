---
id: D0452
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

# `ExercisePanelShell` owns the scored exercise play surface

## Context and Problem Statement
the panels repeated the same ~40 lines and differed only in the big-value expression and the row list (#915), so a layout change had to land nine times.

## Decision Drivers
* The scored exercise panels repeat the same ~40 lines and differ only in the big-value expression and the row list (#915).
* A layout change had to land nine times.
* The rendered markup must stay identical, which a before/after build comparison can prove.

## Considered Options
* Keep the nine panels with their repeated markup.
* Extract `ExercisePanelShell` and keep each panel's name and path (chosen).

## Decision Outcome
Chosen option: "`components/layout/training/exercises/ExercisePanelShell.astro` renders the wrapper, `SinglePlayerDisplay` (`isTarget={false}`), the `dl` of `StatRow`s with the `Time` row appended, `VisitPreview` and `ExerciseBoardInputPanel`. Its `rows` prop is `{ label, value, showWhen? }[]`; `showWhen` wraps a row in `div[x-show][x-cloak]`. The 9 scored panels keep their names and paths and reduce to one call.", because the panels repeated the same ~40 lines and differed only in the big-value expression and the row list (#915), so a layout change had to land nine times.

### Consequences
a new scored exercise panel is a `score` and a row list. `WarmUpPanel` (no scoreboard) is unchanged. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built `training/routines/play` HTML before and after.

* Good, because a new scored exercise panel is a `score` and a row list.
* Neutral, because `WarmUpPanel` (no scoreboard) is unchanged.
* Neutral, because `.astro` carries no unit test (D101). Proof was a byte-for-byte comparison of the built `training/routines/play` HTML before and after.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's parity method builds before any change, copies the built `training/routines/play` HTML aside, rebuilds after and runs `diff -r`. Byte-identical output passes.

## Pros and Cons of the Options
### Keep the nine panels
* Bad, because every layout change lands nine times.

### `ExercisePanelShell`
* Good, because the nine panels reduce to one call each and keep the names and paths the routine play page imports.
* Good, because the `showWhen` row option covers the rows some panels hide.

## Evidence / More Information
Decided: 2026-10-13
Referenced by D0454's `Supersedes:` line.

* `docs/superpowers/specs/2026-10-13-play-screen-shells-design.md` (Goal, Evidence, Task A, Verification): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-10-13-play-screen-shells.md` (Task A decision step): rebuilt Consequences.
* Commit `0adda645` (2026-10-13; #915 task A, adds the D452 row and the inventory update): confirmed the Consequences wording.
