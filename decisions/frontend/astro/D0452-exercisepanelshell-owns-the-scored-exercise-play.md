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
<!-- backfill: pending -->

# `ExercisePanelShell` owns the scored exercise play surface

## Context and Problem Statement
the panels repeated the same ~40 lines and differed only in the big-value expression and the row list (#915), so a layout change had to land nine times.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`components/layout/training/exercises/ExercisePanelShell.astro` renders the wrapper, `SinglePlayerDisplay` (`isTarget={false}`), the `dl` of `StatRow`s with the `Time` row appended, `VisitPreview` and `ExerciseBoardInputPanel`. Its `rows` prop is `{ label, value, showWhen? }[]`; `showWhen` wraps a row in `div[x-show][x-cloak]`. The 9 scored panels keep their names and paths and reduce to one call.", because the panels repeated the same ~40 lines and differed only in the big-value expression and the row list (#915), so a layout change had to land nine times.

### Consequences
a new scored exercise panel is a `score` and a row list. `WarmUpPanel` (no scoreboard) is unchanged. `.astro` carries no unit test (D101); proof was a byte-for-byte comparison of the built `training/routines/play` HTML before and after.

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
Referenced by D0454's `Supersedes:` line.
