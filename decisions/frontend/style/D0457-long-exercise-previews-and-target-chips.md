---
id: D0457
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/style]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Long exercise previews and target chips page six at a time

## Context and Problem Statement
one preview slot or chip per target overflowed the 390px play column past ~6 targets (#954). Paging over a config cap leaves stored snapshots valid.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`windowPage()` (`lib/training/routines/exercise-preview.ts`) cuts a list to the six-item page holding a focus index; `windowIndex()` gives the focus's slot on that page. `visitPreview()` pages its segments on the next (or, once full, last) dart; `switchingSequence()` pages the Switching targets on the engine's `targetIndex`. Lists of six or fewer are unchanged. `SwitchingV1Config` keeps `.max(20)`.", because one preview slot or chip per target overflowed the 390px play column past ~6 targets (#954). Paging over a config cap leaves stored snapshots valid.

### Consequences
a Switching visit over six targets shows only its current page; earlier slots of the visit leave the screen once their page is done. `RouteChips` lights the current part by index (`currentIndexExpr`), not label, so a repeated target or double lights once; Switching, Double Pattern and Switching Target Scoring pass their engine's index (`*ChipIndex()`).

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
Supersedes: D454 in part (`RouteChips` `currentExpr`, now `currentIndexExpr`).
